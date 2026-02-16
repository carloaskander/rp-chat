import { ChatMessage } from "@/types/chat";
import { ApiProfile } from "@/types/settings";

interface GenerateReplyParams {
  profile: ApiProfile;
  messages: ChatMessage[];
  instructionContent?: string;
  characterContent?: string;
}

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiRequestError";
  }
}

function normalizeApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

function buildSystemPrompt(instructionContent?: string, characterContent?: string): string {
  const parts: string[] = [];

  if (instructionContent?.trim()) {
    parts.push(`Instruction preset:\n${instructionContent.trim()}`);
  }
  if (characterContent?.trim()) {
    parts.push(`Character preset:\n${characterContent.trim()}`);
  }

  return parts.join("\n\n");
}

function mapToOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

async function callOpenAICompatible(
  endpoint: string,
  profile: ApiProfile,
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = normalizeApiKey(profile.apiKey);
  const payloadMessages = [
    ...(systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []),
    ...mapToOpenAIMessages(messages),
  ];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: profile.model,
      messages: payloadMessages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiRequestError(
      response.status,
      `API request failed (${response.status}): ${body}`,
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text || typeof text !== "string") {
    throw new Error("No assistant response content was returned.");
  }

  return text;
}

async function callAnthropic(
  profile: ApiProfile,
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = normalizeApiKey(profile.apiKey);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: profile.model,
      max_tokens: 1024,
      system: systemPrompt || undefined,
      messages: messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;

  if (!text || typeof text !== "string") {
    throw new Error("No assistant response content was returned.");
  }

  return text;
}

async function callGoogle(
  profile: ApiProfile,
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = normalizeApiKey(profile.apiKey);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    profile.model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text || typeof text !== "string") {
    throw new Error("No assistant response content was returned.");
  }

  return text;
}

export async function generateAssistantReply({
  profile,
  messages,
  instructionContent,
  characterContent,
}: GenerateReplyParams): Promise<string> {
  const systemPrompt = buildSystemPrompt(instructionContent, characterContent);
  const provider = profile.provider.trim().toLowerCase();
  const apiKey = normalizeApiKey(profile.apiKey);

  if (!apiKey) {
    throw new Error("API key is missing for the selected profile.");
  }
  if (!profile.model.trim()) {
    throw new Error("Model is missing for the selected profile.");
  }

  if (provider === "openai") {
    return callOpenAICompatible(
      "https://api.openai.com/v1/chat/completions",
      profile,
      messages,
      systemPrompt,
    );
  }

  if (provider === "grok" || provider === "xai" || provider === "x.ai") {
    return callOpenAICompatible(
      "https://api.x.ai/v1/chat/completions",
      profile,
      messages,
      systemPrompt,
    );
  }

  if (provider === "kimi" || provider === "moonshot" || provider === "moonshot ai") {
    try {
      return await callOpenAICompatible(
        "https://api.moonshot.ai/v1/chat/completions",
        profile,
        messages,
        systemPrompt,
      );
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        return callOpenAICompatible(
          "https://api.moonshot.cn/v1/chat/completions",
          profile,
          messages,
          systemPrompt,
        );
      }

      throw error;
    }
  }

  if (provider === "anthropic") {
    return callAnthropic(profile, messages, systemPrompt);
  }

  if (provider === "google" || provider === "gemini") {
    return callGoogle(profile, messages, systemPrompt);
  }

  throw new Error(`Unsupported provider: ${profile.provider}`);
}
