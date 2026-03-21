"use client";

import { FormEvent, useState } from "react";
import { Loader2, Mail } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";

export function AuthForm() {
  const { isLoading, signInWithGoogle, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setMessage(null);
    setErrorMessage(null);
    setIsGoogleSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start Google sign-in.",
      );
      setIsGoogleSubmitting(false);
    }
  };

  const handleMagicLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Enter your email address to continue.");
      return;
    }

    setIsEmailSubmitting(true);

    try {
      await sendMagicLink(email.trim());
      setMessage("Magic link sent. Check your email to finish signing in.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not send the magic link.",
      );
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="space-y-1.5 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">Welcome back</h2>
        <p className="text-sm leading-6 text-zinc-400">
          Sign in to unlock chats, saved profiles, and your roleplay history.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={isLoading || isGoogleSubmitting || isEmailSubmitting}
        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-700 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isGoogleSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
            <path
              fill="currentColor"
              d="M21.35 11.1H12v2.98h5.33c-.23 1.5-1.87 4.4-5.33 4.4-3.2 0-5.8-2.65-5.8-5.93s2.6-5.93 5.8-5.93c1.82 0 3.04.78 3.74 1.45l2.55-2.47C16.66 4.1 14.56 3 12 3 6.92 3 2.8 7.13 2.8 12.15S6.92 21.3 12 21.3c6.92 0 9.2-4.85 9.2-7.35 0-.5-.05-.86-.12-1.23Z"
            />
          </svg>
        )}
        <span>Continue with Google</span>
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <span className="h-px flex-1 bg-zinc-800" />
        <span>Email</span>
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
        <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-400">
          Email address
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
          <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || isGoogleSubmitting || isEmailSubmitting}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isEmailSubmitting ? "Sending magic link..." : "Continue with email"}
        </button>
      </form>

      {(message || errorMessage) && (
        <p className={`text-sm leading-6 ${errorMessage ? "text-rose-300" : "text-zinc-300"}`}>
          {errorMessage ?? message}
        </p>
      )}

    </section>
  );
}
