import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { generateStorySummary } from "@/lib/ai-client";
import { getMissingProviderKeyMessage, getUserProviderApiKey } from "@/lib/server/user-api-key";
import { ChatMessage } from "@/types/chat";
import { ApiProfile } from "@/types/settings";

interface SummarizeRequestBody {
  chatId?: string;
  provider?: string;
  model?: string;
  instructionContent?: string;
  characterContent?: string;
  force?: boolean;
}

const ESTIMATED_CONTEXT_LIMIT_TOKENS = 8000;
const SUMMARY_TRIGGER_USAGE_RATIO = 0.68;
const SUMMARY_TRIGGER_TOKEN_ESTIMATE = Math.floor(
  ESTIMATED_CONTEXT_LIMIT_TOKENS * SUMMARY_TRIGGER_USAGE_RATIO,
);
const SUMMARY_RESPONSE_BUFFER_TOKENS =
  ESTIMATED_CONTEXT_LIMIT_TOKENS - SUMMARY_TRIGGER_TOKEN_ESTIMATE;
const SUMMARY_KEEP_RECENT_TOKEN_ESTIMATE = 1400;
const SUMMARY_MIN_CONDENSE_TOKEN_ESTIMATE = 900;
const TOKEN_ESTIMATE_CHARS_PER_TOKEN = 4;
const TOKEN_ESTIMATE_MESSAGE_OVERHEAD = 8;
const SUMMARY_NOTICE_PREFIX = "[summary-notice]";
const SUMMARY_NOTICE_TEXT =
  "Earlier parts of this conversation were summarized to keep context efficient.";

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

function isTransportFailure(message: ChatMessage): boolean {
  return (
    message.role === "assistant" &&
    message.content.startsWith("Request failed:")
  );
}

function isSummaryNotice(message: ChatMessage): boolean {
  return (
    message.role === "assistant" &&
    message.content.startsWith(SUMMARY_NOTICE_PREFIX)
  );
}

function isModelContextMessage(message: ChatMessage): boolean {
  return !isTransportFailure(message) && !isSummaryNotice(message);
}

function estimateMessageTokens(message: ChatMessage): number {
  return Math.ceil(message.content.length / TOKEN_ESTIMATE_CHARS_PER_TOKEN)
    + TOKEN_ESTIMATE_MESSAGE_OVERHEAD;
}

function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0,
  );
}

function findRecentMessageStartIndex(
  messages: ChatMessage[],
  keepRecentTokenBudget: number,
): number {
  let recentTokenEstimate = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (isModelContextMessage(message)) {
      recentTokenEstimate += estimateMessageTokens(message);
    }

    if (recentTokenEstimate >= keepRecentTokenBudget) {
      return index;
    }
  }

  return 0;
}

function findMandatoryPreserveStartIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "user" && isModelContextMessage(message)) {
      return index;
    }
  }

  return Math.max(messages.length - 1, 0);
}

function findCondenseFromIndex(
  messages: ChatMessage[],
  keepRecentTokenBudget: number,
): number {
  const budgetStartIndex = findRecentMessageStartIndex(
    messages,
    keepRecentTokenBudget,
  );
  const mandatoryPreserveStartIndex = findMandatoryPreserveStartIndex(messages);

  return Math.min(budgetStartIndex, mandatoryPreserveStartIndex);
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

    const body = (await request.json()) as SummarizeRequestBody;
    const chatId = body.chatId?.trim() ?? "";
    const provider = body.provider?.trim() ?? "";
    const model = body.model?.trim() ?? "";
    const force = Boolean(body.force);
    const instructionContent = body.instructionContent;
    const characterContent = body.characterContent;

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required." }, { status: 400 });
    }
    if (!provider || !model) {
      return NextResponse.json({ error: "provider and model are required." }, { status: 400 });
    }

    const { data: chatRow, error: chatError } = await supabase
      .from("chats")
      .select("id, user_id, story_summary")
      .eq("id", chatId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (chatError) {
      return NextResponse.json({ error: chatError.message }, { status: 500 });
    }
    if (!chatRow) {
      return NextResponse.json({ error: "Chat not found." }, { status: 404 });
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

    const now = Date.now();
    const messages: ChatMessage[] = (messageRows ?? []).map((row) => ({
      id: row.id,
      role: mapRole(row.role),
      content: row.content,
      createdAt: Number.isNaN(Date.parse(row.created_at))
        ? now
        : Date.parse(row.created_at),
    }));

    const lastContextMessage = [...messages]
      .reverse()
      .find((message) => isModelContextMessage(message));

    if (!lastContextMessage || lastContextMessage.role !== "assistant") {
      return NextResponse.json({ summarized: false, reason: "mid_turn_or_empty" });
    }

    const summarizableMessages = messages.filter((message) =>
      isModelContextMessage(message),
    );
    const totalTokenEstimate = estimateMessagesTokens(summarizableMessages);
    if (!force && totalTokenEstimate < SUMMARY_TRIGGER_TOKEN_ESTIMATE) {
      return NextResponse.json({ summarized: false, reason: "below_trigger" });
    }

    const condenseFromIndex = findCondenseFromIndex(
      messages,
      Math.min(
        SUMMARY_KEEP_RECENT_TOKEN_ESTIMATE,
        ESTIMATED_CONTEXT_LIMIT_TOKENS - SUMMARY_RESPONSE_BUFFER_TOKENS,
      ),
    );

    if (condenseFromIndex <= 0) {
      return NextResponse.json({ summarized: false, reason: "nothing_to_condense" });
    }

    const messagesToCondense = messages
      .slice(0, condenseFromIndex)
      .filter((message) => isModelContextMessage(message));

    if (
      !force &&
      estimateMessagesTokens(messagesToCondense) < SUMMARY_MIN_CONDENSE_TOKEN_ESTIMATE
    ) {
      return NextResponse.json({ summarized: false, reason: "condense_window_small" });
    }

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

    const updatedSummary = await generateStorySummary({
      profile: serverProfile,
      existingSummary: chatRow.story_summary,
      messagesToCondense,
      instructionContent,
      characterContent,
    });
    const nextSummary = updatedSummary.trim();
    if (!nextSummary) {
      return NextResponse.json({ summarized: false, reason: "empty_summary" });
    }

    const idsToArchive = new Set<string>();
    for (const message of messages.slice(0, condenseFromIndex)) {
      idsToArchive.add(message.id);
    }
    for (const message of messages.slice(condenseFromIndex)) {
      if (isSummaryNotice(message)) {
        idsToArchive.add(message.id);
      }
    }

    const idsToArchiveList = [...idsToArchive];
    if (idsToArchiveList.length > 0) {
      const { error: archiveError } = await supabase
        .from("messages")
        .update({ is_archived: true })
        .in("id", idsToArchiveList);
      if (archiveError) {
        return NextResponse.json({ error: archiveError.message }, { status: 500 });
      }
    }

    const summaryNoticeContent = `${SUMMARY_NOTICE_PREFIX} ${SUMMARY_NOTICE_TEXT}`;
    const summaryNoticeId = crypto.randomUUID();
    const summaryNoticeCreatedAtIso = new Date().toISOString();
    const { error: noticeError } = await supabase.from("messages").insert({
      id: summaryNoticeId,
      chat_id: chatId,
      role: "assistant",
      content: summaryNoticeContent,
      created_at: summaryNoticeCreatedAtIso,
      is_archived: false,
    });
    if (noticeError) {
      return NextResponse.json({ error: noticeError.message }, { status: 500 });
    }

    const { error: chatUpdateError } = await supabase
      .from("chats")
      .update({
        story_summary: nextSummary,
        updated_at: summaryNoticeCreatedAtIso,
      })
      .eq("id", chatId)
      .eq("user_id", user.id);
    if (chatUpdateError) {
      return NextResponse.json({ error: chatUpdateError.message }, { status: 500 });
    }

    const { data: remainingRows, error: remainingError } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("chat_id", chatId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });
    if (remainingError) {
      return NextResponse.json({ error: remainingError.message }, { status: 500 });
    }

    const remainingMessages: ChatMessage[] = (remainingRows ?? []).map((row) => ({
      id: row.id,
      role: mapRole(row.role),
      content: row.content,
      createdAt: Number.isNaN(Date.parse(row.created_at))
        ? Date.now()
        : Date.parse(row.created_at),
    }));

    return NextResponse.json({
      summarized: true,
      storySummary: nextSummary,
      messages: remainingMessages,
      updatedAt: Date.parse(summaryNoticeCreatedAtIso),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
