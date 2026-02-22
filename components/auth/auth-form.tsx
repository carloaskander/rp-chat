"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm() {
  const { user, isLoading, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!email.trim() || !password.trim()) {
      setMessage("Email and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "sign-up") {
        await signUpWithEmail(email.trim(), password);
        setMessage("Sign-up successful. Check your email for confirmation if required.");
      } else {
        await signInWithEmail(email.trim(), password);
        setMessage("Signed in.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Auth request failed.";
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-[2px] border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-sm text-zinc-400">
        Checking auth session...
      </section>
    );
  }

  if (user) {
    return (
      <section className="space-y-3 rounded-[2px] border border-zinc-800 bg-zinc-900/40 px-5 py-4">
        <p className="text-sm text-zinc-300">
          Signed in as <span className="font-medium text-zinc-100">{user.email}</span>
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
        >
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-[2px] border border-zinc-800 bg-zinc-900/40 px-5 py-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className={`rounded-[2px] px-2.5 py-1 text-sm ${
            mode === "sign-in" ? "bg-zinc-700 text-zinc-100" : "bg-zinc-800 text-zinc-300"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          className={`rounded-[2px] px-2.5 py-1 text-sm ${
            mode === "sign-up" ? "bg-zinc-700 text-zinc-100" : "bg-zinc-800 text-zinc-300"
          }`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="auth-email" className="block text-xs text-zinc-400">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="w-full rounded-[2px] border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="auth-password" className="block text-xs text-zinc-400">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className="w-full rounded-[2px] border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : mode === "sign-up" ? "Create account" : "Sign in"}
        </button>
      </form>

      {message && <p className="text-sm text-zinc-400">{message}</p>}
    </section>
  );
}
