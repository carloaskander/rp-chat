"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { supabase } from "@/lib/supabase";
import { ApiProfile, SettingsTab } from "@/types/settings";

import { ApiProfileList } from "./api-profile-list";
import { SettingsTabs } from "./settings-tabs";

export function SettingsForm() {
  const { user } = useAuth();
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
    if (activeProfileId) {
      setActiveProfileId(null);
    }
  }, [activeProfileId, setActiveProfileId]);

  const handlePersistApiKey = useCallback(async (params: {
    provider: string;
    apiKey: string;
  }) => {
    if (!user) {
      throw new Error("You must be signed in to save provider API keys.");
    }

    const provider = params.provider.trim();
    const apiKey = params.apiKey.trim();

    if (!provider) {
      throw new Error("Provider is required.");
    }

    if (!apiKey) {
      const { error: deleteError } = await supabase
        .from("api_keys")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
      return;
    }

    const { error } = await supabase
      .from("api_keys")
      .upsert(
        {
          user_id: user.id,
          provider,
          encrypted_key: apiKey,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );

    if (error) {
      throw new Error(error.message);
    }
  }, [user]);

  return (
    <section className="space-y-5">
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "api" && (
        <ApiProfileList
          profiles={profiles}
          onChangeProfiles={setProfiles}
          onPersistApiKey={handlePersistApiKey}
        />
      )}

      {activeTab === "appearance" && (
        <section className="px-5 pb-6">
          <div className="rounded-[2px] bg-zinc-900/60 p-4 text-sm text-zinc-400">
            Appearance settings coming soon.
          </div>
        </section>
      )}

      {activeTab === "advanced" && (
        <section className="px-5 pb-6">
          <div className="rounded-[2px] bg-zinc-900/60 p-4 text-sm text-zinc-400">
            Advanced settings coming soon.
          </div>
        </section>
      )}

      {activeTab === "about" && (
        <section className="px-5 pb-6">
          <div className="rounded-[2px] bg-zinc-900/60 p-4 text-sm text-zinc-400">
            RP Chat MVP. Chat data persists to Supabase; API profiles are local metadata with
            per-user BYOK provider keys in Supabase.
          </div>
        </section>
      )}
    </section>
  );
}
