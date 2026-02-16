import { ApiProfile } from "@/types/settings";

type ProfileDraft = Omit<ApiProfile, "id">;

function normalizeApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

async function fetchOpenAICompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/v1/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Model list failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const models = Array.isArray(data?.data) ? data.data : [];
  return models
    .map((entry: { id?: unknown }) => (typeof entry?.id === "string" ? entry.id : ""))
    .filter((id: string) => id.length > 0)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export async function fetchProviderModels(profile: ProfileDraft): Promise<string[]> {
  const provider = profile.provider.trim().toLowerCase();
  const apiKey = normalizeApiKey(profile.apiKey);

  if (!apiKey) {
    throw new Error("API key is required to load models.");
  }

  if (provider === "openai") {
    return fetchOpenAICompatibleModels("https://api.openai.com", apiKey);
  }

  if (provider === "grok" || provider === "xai" || provider === "x.ai") {
    return fetchOpenAICompatibleModels("https://api.x.ai", apiKey);
  }

  if (provider === "kimi" || provider === "moonshot" || provider === "moonshot ai") {
    try {
      return await fetchOpenAICompatibleModels("https://api.moonshot.ai", apiKey);
    } catch {
      return fetchOpenAICompatibleModels("https://api.moonshot.cn", apiKey);
    }
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Model list failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    return models
      .map((entry: { id?: unknown }) => (typeof entry?.id === "string" ? entry.id : ""))
      .filter((id: string) => id.length > 0)
      .sort((a: string, b: string) => a.localeCompare(b));
  }

  if (provider === "google" || provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: "GET" },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Model list failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];

    return models
      .map((entry: { name?: unknown }) => {
        if (typeof entry?.name !== "string") {
          return "";
        }
        return entry.name.startsWith("models/") ? entry.name.slice(7) : entry.name;
      })
      .filter((id: string) => id.length > 0)
      .sort((a: string, b: string) => a.localeCompare(b));
  }

  throw new Error(`Unsupported provider: ${profile.provider}`);
}
