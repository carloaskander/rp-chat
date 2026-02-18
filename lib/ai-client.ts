import { ChatMessage } from "@/types/chat";
import { ApiProfile } from "@/types/settings";

interface GenerateReplyParams {
  profile: ApiProfile;
  messages: ChatMessage[];
  instructionContent?: string;
  characterContent?: string;
  storySummary?: string | null;
}

interface GenerateStorySummaryParams {
  profile: ApiProfile;
  existingSummary: string | null;
  messagesToCondense: ChatMessage[];
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

function buildSystemPrompt(
  instructionContent?: string,
  characterContent?: string,
  storySummary?: string | null,
): string {
  const parts: string[] = [];

  if (instructionContent?.trim()) {
    parts.push(`Instruction preset:\n${instructionContent.trim()}`);
  }
  if (characterContent?.trim()) {
    parts.push(`Character preset:\n${characterContent.trim()}`);
  }
  if (storySummary?.trim()) {
    parts.push(
      [
        "Story memory summary (living canon):",
        storySummary.trim(),
        "Treat this as established context unless the latest messages clearly contradict it.",
      ].join("\n"),
    );
  }

  return parts.join("\n\n");
}

function buildSummarizationSystemPrompt(
  instructionContent?: string,
  characterContent?: string,
): string {
  const basePrompt = buildSystemPrompt(instructionContent, characterContent);
  const summaryRules = [
    "You maintain a living story memory for a roleplay chat.",
    "Update the existing summary using: (1) prior summary memory and (2) older messages being condensed.",
    "Preserve character identities, relationships, emotional states, motivations, key beats, decisions, unresolved conflicts/goals, and world/location state.",
    "Preserve continuity and roleplay tone; this memory guides future in-character responses.",
    "Treat this as story memory, not a transcript log.",
    "Keep important established facts unless clearly contradicted by newer events.",
    "Remove filler dialogue, repetition, and minor temporary details.",
    "Return only the updated summary text.",
  ].join("\n");

  return basePrompt ? `${basePrompt}\n\n${summaryRules}` : summaryRules;
}

function buildSummarizationUserPrompt(
  existingSummary: string | null,
  messagesToCondense: ChatMessage[],
): string {
  const previousSummary = existingSummary?.trim()
    ? existingSummary.trim()
    : "(none)";
  const transcript = messagesToCondense
    .map((message) => {
      const speaker = message.role === "assistant" ? "Assistant" : "User";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");

  return [
    "Update this living roleplay summary.",
    "Do not rewrite or include recent turns that are not provided here; this request only covers older messages.",
    "Prefer concise narrative prose; bullets are optional only when they improve clarity.",
    "\nExisting summary:\n",
    previousSummary,
    "\nMessages to condense:\n",
    transcript,
  ].join("\n");
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

async function generateWithProvider(
  profile: ApiProfile,
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
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

export async function generateAssistantReply({
  profile,
  messages,
  instructionContent,
  characterContent,
  storySummary,
}: GenerateReplyParams): Promise<string> {
  const systemPrompt = buildSystemPrompt(
    instructionContent,
    characterContent,
    storySummary,
  );

  return generateWithProvider(profile, messages, systemPrompt);
}

export async function generateStorySummary({
  profile,
  existingSummary,
  messagesToCondense,
  instructionContent,
  characterContent,
}: GenerateStorySummaryParams): Promise<string> {
  const systemPrompt = buildSummarizationSystemPrompt(
    instructionContent,
    characterContent,
  );
  const summaryRequest: ChatMessage = {
    id: "story-summary-request",
    role: "user",
    content: buildSummarizationUserPrompt(existingSummary, messagesToCondense),
    createdAt: Date.now(),
  };

  return generateWithProvider(profile, [summaryRequest], systemPrompt);
}
