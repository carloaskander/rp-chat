import { createClient } from "@supabase/supabase-js";

function requireEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to .env.local before using Supabase auth.`,
    );
  }

  return value;
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
