import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { generateAssistantReply } from "@/lib/ai-client";
import {
  isModelContextMessage,
  loadActiveChatMessages,
} from "@/lib/server/chat-messages";
import {
  getMissingProviderKeyMessage,
  getUserProviderApiKey,
  UserApiKeyLookupClient,
} from "@/lib/server/user-api-key";
import { ChatMessage } from "@/types/chat";
import { ApiProfile } from "@/types/settings";

interface SendRequestBody {
  chatId?: string;
  content?: string;
  instructionContent?: string;
  characterContent?: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as SendRequestBody;
    const chatId = body.chatId?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    const instructionContent = body.instructionContent;
    const characterContent = body.characterContent;

    if (!chatId || !content) {
      return NextResponse.json({ error: "chatId and content are required." }, { status: 400 });
    }

    const { data: chatRow, error: chatError } = await supabase
      .from("chats")
      .select("id, story_summary, user_id, api_profile_id")
      .eq("id", chatId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (chatError) {
      return NextResponse.json({ error: chatError.message }, { status: 500 });
    }
    if (!chatRow) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }
    if (!chatRow.api_profile_id) {
      return NextResponse.json({ error: "No API profile selected for this chat." }, { status: 400 });
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("api_profiles")
      .select("id, provider, model, user_id")
      .eq("id", chatRow.api_profile_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    if (!profileRow) {
      return NextResponse.json({ error: "Selected API profile not found." }, { status: 400 });
    }

    const { data: latestSequenceRow, error: latestSequenceError } = await supabase
      .from("messages")
      .select("sequence_number")
      .eq("chat_id", chatId)
      .order("sequence_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestSequenceError) {
      return NextResponse.json({ error: latestSequenceError.message }, { status: 500 });
    }

    const nextSequenceNumber = (latestSequenceRow?.sequence_number ?? 0) + 1;
    const nowIso = new Date().toISOString();
    const userMessageId = crypto.randomUUID();
    const userVersionGroupId = userMessageId;
    const { error: userInsertError } = await supabase.from("messages").insert({
      id: userMessageId,
      chat_id: chatId,
      role: "user",
      content,
      created_at: nowIso,
      version_group_id: userVersionGroupId,
      sequence_number: nextSequenceNumber,
      is_active: true,
    });
    if (userInsertError) {
      return NextResponse.json({ error: userInsertError.message }, { status: 500 });
    }

    const { messages: activeMessages, error: activeMessagesError } =
      await loadActiveChatMessages(supabase, chatId, { includeArchived: false });
    if (activeMessagesError || !activeMessages) {
      return NextResponse.json({ error: activeMessagesError ?? "Failed to load messages." }, { status: 500 });
    }

    const modelMessages: ChatMessage[] = activeMessages.filter((message) =>
      isModelContextMessage(message),
    );

    const { apiKey, error: apiKeyError } = await getUserProviderApiKey({
      supabase: supabase as unknown as UserApiKeyLookupClient,
      userId: user.id,
      provider: profileRow.provider,
    });
    if (apiKeyError) {
      if (apiKeyError === getMissingProviderKeyMessage()) {
        return NextResponse.json({ error: apiKeyError }, { status: 400 });
      }
      return NextResponse.json({ error: apiKeyError }, { status: 500 });
    }

    const serverProfile: ApiProfile = {
      id: "server-profile",
      name: "Server Profile",
      provider: profileRow.provider,
      model: profileRow.model,
      apiKey: apiKey ?? "",
    };

    const reply = await generateAssistantReply({
      profile: serverProfile,
      messages: modelMessages,
      instructionContent,
      characterContent,
      storySummary: chatRow.story_summary,
    });

    const assistantMessageId = crypto.randomUUID();
    const assistantVersionGroupId = assistantMessageId;
    const assistantCreatedAtIso = new Date().toISOString();
    const { error: assistantInsertError } = await supabase.from("messages").insert({
      id: assistantMessageId,
      chat_id: chatId,
      role: "assistant",
      content: reply,
      created_at: assistantCreatedAtIso,
      version_group_id: assistantVersionGroupId,
      sequence_number: nextSequenceNumber + 1,
      is_active: true,
      response_to_message_id: userMessageId,
    });
    if (assistantInsertError) {
      return NextResponse.json({ error: assistantInsertError.message }, { status: 500 });
    }

    const { error: chatUpdateError } = await supabase
      .from("chats")
      .update({ updated_at: assistantCreatedAtIso })
      .eq("id", chatId)
      .eq("user_id", user.id);
    if (chatUpdateError) {
      return NextResponse.json({ error: chatUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      userMessage: {
        id: userMessageId,
        role: "user",
        content,
        createdAt: Date.parse(nowIso),
        versionGroupId: userVersionGroupId,
        sequenceNumber: nextSequenceNumber,
        versions: [
          {
            id: userMessageId,
            createdAt: Date.parse(nowIso),
          },
        ],
        activeVersionIndex: 0,
      },
      assistantMessage: {
        id: assistantMessageId,
        role: "assistant",
        content: reply,
        createdAt: Date.parse(assistantCreatedAtIso),
        versionGroupId: assistantVersionGroupId,
        sequenceNumber: nextSequenceNumber + 1,
        versions: [
          {
            id: assistantMessageId,
            createdAt: Date.parse(assistantCreatedAtIso),
          },
        ],
        activeVersionIndex: 0,
      },
      updatedAt: Date.parse(assistantCreatedAtIso),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
