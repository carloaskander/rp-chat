import type { SupabaseClient } from "@supabase/supabase-js";

import { ChatMessage, MessageVersion } from "@/types/chat";

export const SUMMARY_NOTICE_PREFIX = "[summary-notice]";

export interface ActiveMessageRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
  sequence_number: number;
  version_group_id: string;
  is_archived?: boolean;
}

interface MessageVersionRow {
  id: string;
  created_at: string;
  version_group_id: string;
}

export function mapRole(role: string): ChatMessage["role"] {
  return role === "assistant" ? "assistant" : "user";
}

export function isSummaryNoticeContent(content: string): boolean {
  return content.startsWith(SUMMARY_NOTICE_PREFIX);
}

export function isSummaryNoticeMessage(message: Pick<ChatMessage, "role" | "content">): boolean {
  return message.role === "assistant" && isSummaryNoticeContent(message.content);
}

export function isTransportFailureMessage(
  message: Pick<ChatMessage, "role" | "content">,
): boolean {
  return (
    message.role === "assistant" &&
    message.content.startsWith("Request failed:")
  );
}

export function isModelContextMessage(message: Pick<ChatMessage, "role" | "content">): boolean {
  return !isTransportFailureMessage(message) && !isSummaryNoticeMessage(message);
}

function mapVersionRow(row: MessageVersionRow): MessageVersion {
  const parsedCreatedAt = Date.parse(row.created_at);

  return {
    id: row.id,
    createdAt: Number.isNaN(parsedCreatedAt) ? Date.now() : parsedCreatedAt,
  };
}

export function buildVersionsByGroup(rows: MessageVersionRow[]): Map<string, MessageVersion[]> {
  const versionsByGroup = new Map<string, MessageVersion[]>();

  for (const row of rows) {
    const existingVersions = versionsByGroup.get(row.version_group_id) ?? [];
    existingVersions.push(mapVersionRow(row));
    versionsByGroup.set(row.version_group_id, existingVersions);
  }

  return versionsByGroup;
}

export function mapActiveMessageRowToChatMessage(
  row: ActiveMessageRow,
  versionsByGroup: Map<string, MessageVersion[]>,
): ChatMessage {
  const parsedCreatedAt = Date.parse(row.created_at);
  const versions = versionsByGroup.get(row.version_group_id) ?? [
    {
      id: row.id,
      createdAt: Number.isNaN(parsedCreatedAt) ? Date.now() : parsedCreatedAt,
    },
  ];
  const activeVersionIndex = Math.max(
    versions.findIndex((version) => version.id === row.id),
    0,
  );

  return {
    id: row.id,
    role: mapRole(row.role),
    content: row.content,
    createdAt: Number.isNaN(parsedCreatedAt) ? Date.now() : parsedCreatedAt,
    versionGroupId: row.version_group_id,
    sequenceNumber: row.sequence_number,
    versions,
    activeVersionIndex,
  };
}

export async function loadActiveChatMessages(
  supabase: SupabaseClient,
  chatId: string,
  options?: {
    includeArchived?: boolean;
  },
): Promise<{ messages: ChatMessage[] | null; error: string | null }> {
  let query = supabase
    .from("messages")
    .select("id, role, content, created_at, sequence_number, version_group_id, is_archived")
    .eq("chat_id", chatId)
    .eq("is_active", true);

  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data: activeRows, error: activeError } = await query.order(
    "sequence_number",
    { ascending: true },
  );

  if (activeError) {
    return { messages: null, error: activeError.message };
  }

  const versionGroupIds = [...new Set((activeRows ?? []).map((row) => row.version_group_id))];
  if (versionGroupIds.length === 0) {
    return { messages: [], error: null };
  }

  const { data: versionRows, error: versionsError } = await supabase
    .from("messages")
    .select("id, created_at, version_group_id")
    .in("version_group_id", versionGroupIds)
    .order("created_at", { ascending: true });

  if (versionsError) {
    return { messages: null, error: versionsError.message };
  }

  const versionsByGroup = buildVersionsByGroup(versionRows ?? []);
  const messages = (activeRows ?? []).map((row) =>
    mapActiveMessageRowToChatMessage(row, versionsByGroup),
  );

  return { messages, error: null };
}
