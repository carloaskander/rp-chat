"use client";

import { useEffect, useState } from "react";

import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { ApiProfile, SettingsTab } from "@/types/settings";

import { ApiProfileList } from "./api-profile-list";
import { SettingsTabs } from "./settings-tabs";

export function SettingsForm() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api");
  const [profiles, setProfiles] = useLocalStorageState<ApiProfile[]>(
    STORAGE_KEYS.apiProfiles,
    [],
  );
  const [activeProfileId, setActiveProfileId] = useLocalStorageState<string | null>(
    STORAGE_KEYS.activeApiProfileId,
    null,
  );

  useEffect(() => {
    if (profiles.length === 0) {
      if (activeProfileId !== null) {
        setActiveProfileId(null);
      }
      return;
    }

    if (!activeProfileId || !profiles.some((profile) => profile.id === activeProfileId)) {
      setActiveProfileId(profiles[0].id);
    }
  }, [activeProfileId, profiles, setActiveProfileId]);

  return (
    <section className="space-y-5">
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "api" && (
        <ApiProfileList
          profiles={profiles}
          activeProfileId={activeProfileId}
          onChangeProfiles={setProfiles}
          onChangeActiveProfileId={setActiveProfileId}
        />
      )}

      {activeTab === "appearance" && (
        <section className="px-5 pb-6">
          <div className="rounded-xl bg-zinc-900/60 p-4 text-sm text-zinc-400">
            Appearance settings coming soon.
          </div>
        </section>
      )}

      {activeTab === "advanced" && (
        <section className="px-5 pb-6">
          <div className="rounded-xl bg-zinc-900/60 p-4 text-sm text-zinc-400">
            Advanced settings coming soon.
          </div>
        </section>
      )}

      {activeTab === "about" && (
        <section className="px-5 pb-6">
          <div className="rounded-xl bg-zinc-900/60 p-4 text-sm text-zinc-400">
            RP Chat MVP. Local-only settings, no backend/auth yet.
          </div>
        </section>
      )}
    </section>
  );
}