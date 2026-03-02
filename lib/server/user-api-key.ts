import { decryptApiKey } from "@/lib/server/api-key-crypto";

const NO_API_KEY_CONFIGURED_MESSAGE = "No API key configured for this provider.";

function toCanonicalProvider(providerRaw: string): string {
  const provider = providerRaw.trim().toLowerCase();

  if (provider === "openai") {
    return "openai";
  }
  if (provider === "grok" || provider === "xai" || provider === "x.ai") {
    return "xai";
  }
  if (provider === "kimi" || provider === "moonshot" || provider === "moonshot ai") {
    return "kimi";
  }
  if (provider === "anthropic") {
    return "anthropic";
  }
  if (provider === "google" || provider === "gemini") {
    return "google";
  }

  return provider;
}

export function getMissingProviderKeyMessage(): string {
  return NO_API_KEY_CONFIGURED_MESSAGE;
}

export async function getUserProviderApiKey(params: {
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{
            data: Array<{
              provider: string;
              encrypted_key: string;
              created_at: string;
            }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  userId: string;
  provider: string;
}): Promise<{ apiKey: string | null; error: string | null }> {
  const { supabase, userId, provider } = params;

  const { data, error } = await supabase
    .from("api_keys")
    .select("provider, encrypted_key, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { apiKey: null, error: error.message };
  }

  const requestedCanonicalProvider = toCanonicalProvider(provider);
  const matched = (data ?? []).find(
    (row) => toCanonicalProvider(row.provider) === requestedCanonicalProvider,
  );

  if (!matched?.encrypted_key?.trim()) {
    return { apiKey: null, error: NO_API_KEY_CONFIGURED_MESSAGE };
  }

  try {
    const decrypted = decryptApiKey(matched.encrypted_key);
    if (!decrypted.trim()) {
      return { apiKey: null, error: NO_API_KEY_CONFIGURED_MESSAGE };
    }

    return { apiKey: decrypted.trim(), error: null };
  } catch (error) {
    return {
      apiKey: null,
      error: error instanceof Error ? error.message : "Could not decrypt API key.",
    };
  }
}
