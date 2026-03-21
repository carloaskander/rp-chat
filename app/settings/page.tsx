import Link from "next/link";

import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsTab } from "@/types/settings";

const validSections = new Set<SettingsTab>(["account", "api", "appearance", "about"]);

interface SettingsPageProps {
  searchParams?: Promise<{ section?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSection = resolvedSearchParams?.section;
  const initialTab: SettingsTab = validSections.has(requestedSection as SettingsTab)
    ? (requestedSection as SettingsTab)
    : "account";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between px-5 py-4">
        <h1 className="text-lg font-medium tracking-tight text-zinc-100">Settings</h1>
        <Link
          href="/"
          className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
        >
          Back to Chat
        </Link>
      </header>
      <SettingsForm key={initialTab} initialTab={initialTab} />
    </main>
  );
}
