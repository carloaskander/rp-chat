import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { generateAssistantReply } from "@/lib/ai-client";
import { loadActiveChatMessages } from "@/lib/server/chat-messages";
import {
  getMissingProviderKeyMessage,
  getUserProviderApiKey,
  UserApiKeyLookupClient,
} from "@/lib/server/user-api-key";
import { ApiProfile } from "@/types/settings";

interface MessageVersionRequestBody {
  chatId?: string;
  messageId?: string;
  targetVersionId?: string;
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

export async function PATCH(request: NextRequest) {
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

    const body = (await request.json()) as MessageVersionRequestBody;
    const chatId = body.chatId?.trim() ?? "";
    const messageId = body.messageId?.trim() ?? "";
    const targetVersionId = body.targetVersionId?.trim() ?? "";
    const nextContent = body.content?.trim();
    const instructionContent = body.instructionContent;
    const characterContent = body.characterContent;

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required." }, { status: 400 });
    }
    if (!messageId && !targetVersionId) {
      return NextResponse.json(
        { error: "messageId or targetVersionId is required." },
        { status: 400 },
      );
    }
    if (messageId && nextContent !== undefined && nextContent.length === 0) {
      return NextResponse.json({ error: "Edited content cannot be empty." }, { status: 400 });
    }

    const { data: chatRow, error: chatError } = await supabase
      .from("chats")
      .select("id, user_id, story_summary, api_profile_id")
      .eq("id", chatId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (chatError) {
      return NextResponse.json({ error: chatError.message }, { status: 500 });
    }
    if (!chatRow) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
    }

    const targetMessageId = targetVersionId || messageId;
    const { data: targetMessageRow, error: targetMessageError } = await supabase
      .from("messages")
      .select("id, role, content, sequence_number, version_group_id, chat_id, response_to_message_id")
      .eq("id", targetMessageId)
      .eq("chat_id", chatId)
      .maybeSingle();
    if (targetMessageError) {
      return NextResponse.json({ error: targetMessageError.message }, { status: 500 });
    }
    if (!targetMessageRow) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    let activeMessageId = targetMessageRow.id;
    let activeMessageContent = targetMessageRow.content;
    const activeMessageRole = targetMessageRow.role;
    const activeVersionGroupId = targetMessageRow.version_group_id;
    const targetSequenceNumber = targetMessageRow.sequence_number;
    const mutationTimestampIso = new Date().toISOString();
    const isEditingExistingMessage = Boolean(messageId && nextContent !== undefined);

    if (messageId && nextContent !== undefined) {
      const newVersionId = crypto.randomUUID();
      const { error: insertVersionError } = await supabase.from("messages").insert({
        id: newVersionId,
        chat_id: chatId,
        role: targetMessageRow.role,
        content: nextContent,
        created_at: mutationTimestampIso,
        version_group_id: activeVersionGroupId,
        sequence_number: targetSequenceNumber,
        is_archived: false,
        is_active: false,
        response_to_message_id: targetMessageRow.response_to_message_id,
      });
      if (insertVersionError) {
        return NextResponse.json({ error: insertVersionError.message }, { status: 500 });
      }

      const { error: deactivatePreviousVersionsError } = await supabase
        .from("messages")
        .update({ is_active: false })
        .eq("chat_id", chatId)
        .eq("version_group_id", activeVersionGroupId)
        .neq("id", newVersionId);
      if (deactivatePreviousVersionsError) {
        return NextResponse.json(
          { error: deactivatePreviousVersionsError.message },
          { status: 500 },
        );
      }

      const { error: activateNewVersionError } = await supabase
        .from("messages")
        .update({
          is_active: true,
          is_archived: false,
        })
        .eq("id", newVersionId)
        .eq("chat_id", chatId);
      if (activateNewVersionError) {
        return NextResponse.json(
          { error: activateNewVersionError.message },
          { status: 500 },
        );
      }

      activeMessageId = newVersionId;
      activeMessageContent = nextContent;
    } else {
      const { error: deactivateOtherVersionsError } = await supabase
        .from("messages")
        .update({ is_active: false })
        .eq("chat_id", chatId)
        .eq("version_group_id", activeVersionGroupId)
        .neq("id", targetMessageRow.id);
      if (deactivateOtherVersionsError) {
        return NextResponse.json({ error: deactivateOtherVersionsError.message }, { status: 500 });
      }

      const { error: activateVersionError } = await supabase
        .from("messages")
        .update({
          is_active: true,
          is_archived: false,
        })
        .eq("id", targetMessageRow.id)
        .eq("chat_id", chatId);
      if (activateVersionError) {
        return NextResponse.json({ error: activateVersionError.message }, { status: 500 });
      }
    }

    const { error: deleteLaterMessagesError } = await supabase
      .from("messages")
      .delete()
      .eq("chat_id", chatId)
      .gt(
        "sequence_number",
        activeMessageRole === "user" ? targetSequenceNumber + 1 : targetSequenceNumber,
      );
    if (deleteLaterMessagesError) {
      return NextResponse.json({ error: deleteLaterMessagesError.message }, { status: 500 });
    }

    const { error: deleteSummaryNoticeError } = await supabase
      .from("messages")
      .delete()
      .eq("chat_id", chatId)
      .eq("role", "assistant")
      .like("content", "[summary-notice]%");
    if (deleteSummaryNoticeError) {
      return NextResponse.json({ error: deleteSummaryNoticeError.message }, { status: 500 });
    }

    const { error: unarchiveRemainingError } = await supabase
      .from("messages")
      .update({ is_archived: false })
      .eq("chat_id", chatId);
    if (unarchiveRemainingError) {
      return NextResponse.json({ error: unarchiveRemainingError.message }, { status: 500 });
    }

    let updatedAtIso = mutationTimestampIso;
    if (activeMessageRole === "user") {
      const assistantSequenceNumber = targetSequenceNumber + 1;
      const { data: assistantSlotRow, error: assistantSlotError } = await supabase
        .from("messages")
        .select("id, version_group_id")
        .eq("chat_id", chatId)
        .eq("sequence_number", assistantSequenceNumber)
        .limit(1)
        .maybeSingle();
      if (assistantSlotError) {
        return NextResponse.json({ error: assistantSlotError.message }, { status: 500 });
      }

      if (assistantSlotRow) {
        const { error: deactivateAssistantSlotError } = await supabase
          .from("messages")
          .update({ is_active: false })
          .eq("chat_id", chatId)
          .eq("version_group_id", assistantSlotRow.version_group_id);
        if (deactivateAssistantSlotError) {
          return NextResponse.json({ error: deactivateAssistantSlotError.message }, { status: 500 });
        }
      }

      const { data: storedAssistantRow, error: storedAssistantError } = await supabase
        .from("messages")
        .select("id, version_group_id")
        .eq("chat_id", chatId)
        .eq("sequence_number", assistantSequenceNumber)
        .eq("response_to_message_id", activeMessageId)
        .maybeSingle();
      if (storedAssistantError) {
        return NextResponse.json({ error: storedAssistantError.message }, { status: 500 });
      }

      if (storedAssistantRow) {
        const { error: deactivateStoredAssistantPeersError } = await supabase
          .from("messages")
          .update({ is_active: false })
          .eq("chat_id", chatId)
          .eq("version_group_id", storedAssistantRow.version_group_id)
          .neq("id", storedAssistantRow.id);
        if (deactivateStoredAssistantPeersError) {
          return NextResponse.json(
            { error: deactivateStoredAssistantPeersError.message },
            { status: 500 },
          );
        }

        const { error: activateStoredAssistantError } = await supabase
          .from("messages")
          .update({
            is_active: true,
            is_archived: false,
          })
          .eq("id", storedAssistantRow.id)
          .eq("chat_id", chatId);
        if (activateStoredAssistantError) {
          return NextResponse.json({ error: activateStoredAssistantError.message }, { status: 500 });
        }
      } else if (isEditingExistingMessage) {
        if (!chatRow.api_profile_id) {
          return NextResponse.json(
            { error: "No API profile selected for this chat." },
            { status: 400 },
          );
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

        const { messages: modelMessages, error: modelMessagesError } =
          await loadActiveChatMessages(supabase, chatId, { includeArchived: false });
        if (modelMessagesError || !modelMessages) {
          return NextResponse.json({ error: modelMessagesError ?? "Failed to load messages." }, { status: 500 });
        }

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

        const assistantCreatedAtIso = new Date().toISOString();
        const assistantMessageId = crypto.randomUUID();
        let assistantContent: string;

        try {
          assistantContent = await generateAssistantReply({
            profile: serverProfile,
            messages: modelMessages,
            instructionContent,
            characterContent,
            storySummary: null,
          });
        } catch (error) {
          assistantContent =
            error instanceof Error
              ? `Request failed: ${error.message}`
              : "Request failed: unknown error";
        }

        const assistantVersionGroupId = assistantSlotRow?.version_group_id ?? assistantMessageId;
        const { error: insertAssistantError } = await supabase.from("messages").insert({
          id: assistantMessageId,
          chat_id: chatId,
          role: "assistant",
          content: assistantContent,
          created_at: assistantCreatedAtIso,
          version_group_id: assistantVersionGroupId,
          sequence_number: assistantSequenceNumber,
          is_archived: false,
          is_active: false,
          response_to_message_id: activeMessageId,
        });
        if (insertAssistantError) {
          return NextResponse.json({ error: insertAssistantError.message }, { status: 500 });
        }

        const { error: deactivateAssistantPeersError } = await supabase
          .from("messages")
          .update({ is_active: false })
          .eq("chat_id", chatId)
          .eq("version_group_id", assistantVersionGroupId)
          .neq("id", assistantMessageId);
        if (deactivateAssistantPeersError) {
          return NextResponse.json({ error: deactivateAssistantPeersError.message }, { status: 500 });
        }

        const { error: activateAssistantError } = await supabase
          .from("messages")
          .update({
            is_active: true,
            is_archived: false,
          })
          .eq("id", assistantMessageId)
          .eq("chat_id", chatId);
        if (activateAssistantError) {
          return NextResponse.json({ error: activateAssistantError.message }, { status: 500 });
        }

        updatedAtIso = assistantCreatedAtIso;
      }
    }

    const { error: chatUpdateError } = await supabase
      .from("chats")
      .update({
        story_summary: null,
        updated_at: updatedAtIso,
      })
      .eq("id", chatId)
      .eq("user_id", user.id);
    if (chatUpdateError) {
      return NextResponse.json({ error: chatUpdateError.message }, { status: 500 });
    }

    const { messages: activeMessages, error: activeMessagesError } =
      await loadActiveChatMessages(supabase, chatId, { includeArchived: true });
    if (activeMessagesError || !activeMessages) {
      return NextResponse.json({ error: activeMessagesError ?? "Failed to load messages." }, { status: 500 });
    }

    return NextResponse.json({
      messages: activeMessages,
      storySummary: null,
      updatedAt: Date.parse(updatedAtIso),
      regenerated: activeMessageRole === "user",
      activeMessageId,
      activeMessageContent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
