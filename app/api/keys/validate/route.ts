import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { validateProviderApiKey } from "@/lib/profile-validation";
import { getUserProviderApiKey } from "@/lib/server/user-api-key";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function createAuthedSupabaseClient(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { client: null, userId: null, error: "Missing bearer token." };
  }

  const accessToken = authHeader.slice(7).trim();
  if (!accessToken) {
    return { client: null, userId: null, error: "Missing bearer token." };
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
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { client: null, userId: null, error: "Unauthorized." };
  }

  return { client: supabase, userId: user.id, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, userId, error } = await createAuthedSupabaseClient(request);
    if (error || !supabase || !userId) {
      return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as { provider?: string };
    const provider = (body.provider ?? "").trim();

    if (!provider) {
      return NextResponse.json({ error: "Provider is required." }, { status: 400 });
    }

    const { apiKey, error: apiKeyError } = await getUserProviderApiKey({
      supabase,
      userId,
      provider,
    });

    if (apiKeyError || !apiKey) {
      return NextResponse.json(
        { ok: false, message: apiKeyError ?? "API key is missing." },
        { status: 200 },
      );
    }

    const result = await validateProviderApiKey(provider, apiKey);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
