import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsTab } from "@/types/settings";

const validSections = new Set<SettingsTab>(["account", "api", "appearance", "about"]);

interface SettingsPageProps {
  searchParams?: Promise<{ section?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSection = resolvedSearchParams?.section;
  const hasExplicitSection = validSections.has(requestedSection as SettingsTab);
  const initialTab: SettingsTab = hasExplicitSection ? (requestedSection as SettingsTab) : "account";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between px-5 py-4">
        <h1 className="text-lg font-medium tracking-tight text-zinc-100">Settings</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Home</span>
        </Link>
      </header>
      <SettingsForm key={`${initialTab}-${hasExplicitSection ? "detail" : "list"}`} initialTab={initialTab} startInDetail={hasExplicitSection} />
    </main>
  );
}
