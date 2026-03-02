import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { encryptApiKey } from "@/lib/server/api-key-crypto";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function canonicalizeProvider(providerRaw: string): string {
  const provider = providerRaw.trim().toLowerCase();

  if (provider === "grok" || provider === "xai" || provider === "x.ai") {
    return "xai";
  }
  if (provider === "google" || provider === "gemini") {
    return "google";
  }
  if (provider === "kimi" || provider === "moonshot" || provider === "moonshot ai") {
    return "kimi";
  }

  return provider;
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

    const body = (await request.json()) as {
      provider?: string;
      apiKey?: string;
    };
    const provider = canonicalizeProvider(body.provider ?? "");
    const apiKey = (body.apiKey ?? "").trim();

    if (!provider) {
      return NextResponse.json({ error: "Provider is required." }, { status: 400 });
    }

    if (!apiKey) {
      const { error: deleteError } = await supabase
        .from("api_keys")
        .delete()
        .eq("user_id", userId)
        .eq("provider", provider);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, deleted: true });
    }

    const encryptedKey = encryptApiKey(apiKey);

    const { error: upsertError } = await supabase
      .from("api_keys")
      .upsert(
        {
          user_id: userId,
          provider,
          encrypted_key: encryptedKey,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
