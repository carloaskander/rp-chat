import { createClient } from "@supabase/supabase-js";

function requireEnv(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to .env.local before using Supabase auth.`,
    );
  }

  return value;
}

const supabaseUrl = requireEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const supabaseAnonKey = requireEnv(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
