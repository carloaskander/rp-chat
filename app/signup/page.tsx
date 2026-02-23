import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Create account</h1>
        <p className="text-sm text-zinc-400">Sign up with email and password.</p>
      </header>
      <AuthForm initialMode="sign-up" showModeToggle={false} />
      <Link
        href="/"
        className="text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        Back to chat
      </Link>
    </main>
  );
}
