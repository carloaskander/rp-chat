import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { generateAssistantReply } from "@/lib/ai-client";
import { getMissingProviderKeyMessage, getUserProviderApiKey } from "@/lib/server/user-api-key";
import { ChatMessage } from "@/types/chat";
import { ApiProfile } from "@/types/settings";

interface SendRequestBody {
  chatId?: string;
  content?: string;
  provider?: string;
  model?: string;
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

function mapRole(role: string): ChatMessage["role"] {
  return role === "assistant" ? "assistant" : "user";
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
    const provider = body.provider?.trim() ?? "";
    const model = body.model?.trim() ?? "";
    const instructionContent = body.instructionContent;
    const characterContent = body.characterContent;

    if (!chatId || !content) {
      return NextResponse.json({ error: "chatId and content are required." }, { status: 400 });
    }
    if (!provider || !model) {
      return NextResponse.json({ error: "provider and model are required." }, { status: 400 });
    }

    const { data: chatRow, error: chatError } = await supabase
      .from("chats")
      .select("id, story_summary, user_id")
      .eq("id", chatId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (chatError) {
      return NextResponse.json({ error: chatError.message }, { status: 500 });
    }
    if (!chatRow) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const userMessageId = crypto.randomUUID();
    const { error: userInsertError } = await supabase.from("messages").insert({
      id: userMessageId,
      chat_id: chatId,
      role: "user",
      content,
      created_at: nowIso,
    });
    if (userInsertError) {
      return NextResponse.json({ error: userInsertError.message }, { status: 500 });
    }

    const { data: messageRows, error: messagesError } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });
    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    const modelMessages: ChatMessage[] = (messageRows ?? [])
      .filter((row) => !row.content.startsWith("[summary-notice]"))
      .filter(
        (row) => !(row.role === "assistant" && row.content.startsWith("Request failed:")),
      )
      .map((row) => ({
        id: row.id,
        role: mapRole(row.role),
        content: row.content,
        createdAt: Number.isNaN(Date.parse(row.created_at))
          ? Date.now()
          : Date.parse(row.created_at),
      }));

    const { apiKey, error: apiKeyError } = await getUserProviderApiKey({
      supabase,
      userId: user.id,
      provider,
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
      provider,
      model,
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
    const assistantCreatedAtIso = new Date().toISOString();
    const { error: assistantInsertError } = await supabase.from("messages").insert({
      id: assistantMessageId,
      chat_id: chatId,
      role: "assistant",
      content: reply,
      created_at: assistantCreatedAtIso,
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
      assistantMessage: {
        id: assistantMessageId,
        role: "assistant",
        content: reply,
        createdAt: Date.parse(assistantCreatedAtIso),
      },
      updatedAt: Date.parse(assistantCreatedAtIso),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
