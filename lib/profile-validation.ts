import { ApiProfile } from "@/types/settings";

interface ValidationResult {
  ok: boolean;
  message: string;
}

function normalizeApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

async function checkOpenAICompatible(baseUrl: string, apiKey: string): Promise<Response> {
  return fetch(`${baseUrl}/v1/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

async function validateKimi(apiKey: string): Promise<ValidationResult> {
  const primary = await checkOpenAICompatible("https://api.moonshot.ai", apiKey);
  if (primary.ok) {
    return { ok: true, message: "Kimi key validated successfully." };
  }

  if (primary.status === 401 || primary.status === 403 || primary.status === 404) {
    const fallback = await checkOpenAICompatible("https://api.moonshot.cn", apiKey);
    if (fallback.ok) {
      return { ok: true, message: "Kimi key validated successfully." };
    }
    const body = await fallback.text();
    return { ok: false, message: `Validation failed (${fallback.status}): ${body}` };
  }

  const body = await primary.text();
  return { ok: false, message: `Validation failed (${primary.status}): ${body}` };
}

export async function validateApiProfile(profile: ApiProfile): Promise<ValidationResult> {
  const apiKey = normalizeApiKey(profile.apiKey);
  if (!apiKey) {
    return { ok: false, message: "API key is missing." };
  }

  const provider = profile.provider.trim().toLowerCase();

  try {
    if (provider === "openai") {
      const response = await checkOpenAICompatible("https://api.openai.com", apiKey);
      if (response.ok) {
        return { ok: true, message: "OpenAI key validated successfully." };
      }
      const body = await response.text();
      return { ok: false, message: `Validation failed (${response.status}): ${body}` };
    }

    if (provider === "grok" || provider === "xai" || provider === "x.ai") {
      const response = await checkOpenAICompatible("https://api.x.ai", apiKey);
      if (response.ok) {
        return { ok: true, message: "Grok/xAI key validated successfully." };
      }
      const body = await response.text();
      return { ok: false, message: `Validation failed (${response.status}): ${body}` };
    }

    if (provider === "kimi" || provider === "moonshot" || provider === "moonshot ai") {
      return validateKimi(apiKey);
    }

    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      if (response.ok) {
        return { ok: true, message: "Anthropic key validated successfully." };
      }
      const body = await response.text();
      return { ok: false, message: `Validation failed (${response.status}): ${body}` };
    }

    if (provider === "google" || provider === "gemini") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { method: "GET" },
      );
      if (response.ok) {
        return { ok: true, message: "Google key validated successfully." };
      }
      const body = await response.text();
      return { ok: false, message: `Validation failed (${response.status}): ${body}` };
    }

    return { ok: false, message: `Unsupported provider: ${profile.provider}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown validation error.",
    };
  }
}
