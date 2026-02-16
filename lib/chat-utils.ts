import { ChatMessage, ChatSession } from "@/types/chat";

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

export function buildChatTitle(messages: ChatMessage[], fallbackIndex: number): string {
  const firstUserMessage = messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0,
  );

  if (!firstUserMessage) {
    return `New Chat ${fallbackIndex}`;
  }

  return truncate(firstUserMessage.content.trim(), 44);
}

export function createEmptyChatSession(index: number): ChatSession {
  const now = Date.now();

  return {
    id: createId(),
    title: `New Chat ${index}`,
    apiProfileId: null,
    characterPresetId: null,
    instructionPresetId: null,
    settingsConfigured: false,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function formatChatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

