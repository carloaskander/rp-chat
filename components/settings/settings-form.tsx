"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { ApiProfile, SettingsTab } from "@/types/settings";

import { ApiProfileList } from "./api-profile-list";
import { SettingsTabs } from "./settings-tabs";

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

export function SettingsForm() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("api");
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadProfiles = async () => {
      const [profilesResult, keysResult] = await Promise.all([
        supabase
          .from("api_profiles")
          .select("id, name, provider, model, created_at, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("api_keys")
          .select("provider, encrypted_key")
          .eq("user_id", user.id),
      ]);

      if (cancelled) {
        return;
      }

      if (profilesResult.error) {
        console.error("Failed to load API profiles from Supabase.", profilesResult.error);
        return;
      }

      if (keysResult.error) {
        console.error("Failed to load API keys from Supabase.", keysResult.error);
        return;
      }

      const keyByProvider = new Map<string, string>();
      for (const row of keysResult.data ?? []) {
        const canonicalProvider = canonicalizeProvider(row.provider);
        if (!canonicalProvider || !row.encrypted_key?.trim()) {
          continue;
        }
        keyByProvider.set(canonicalProvider, row.encrypted_key.trim());
      }

      const nextProfiles: ApiProfile[] = (profilesResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        provider: row.provider,
        model: row.model,
        apiKey: keyByProvider.get(canonicalizeProvider(row.provider)) ?? "",
      }));
      setProfiles(nextProfiles);
    };

    void loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handlePersistApiKey = useCallback(async (params: {
    provider: string;
    apiKey: string;
  }) => {
    if (!user) {
      throw new Error("You must be signed in to save provider API keys.");
    }

    const provider = params.provider.trim();
    const canonicalProvider = canonicalizeProvider(provider);
    const apiKey = params.apiKey.trim();

    if (!canonicalProvider) {
      throw new Error("Provider is required.");
    }

    if (!apiKey) {
      const { error: deleteError } = await supabase
        .from("api_keys")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", canonicalProvider);

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
          provider: canonicalProvider,
          encrypted_key: apiKey,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );

    if (error) {
      throw new Error(error.message);
    }
  }, [user]);

  const handleCreateProfile = useCallback(async (value: Omit<ApiProfile, "id">) => {
    if (!user) {
      throw new Error("You must be signed in to create API profiles.");
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("api_profiles")
      .insert({
        user_id: user.id,
        name: value.name,
        provider: value.provider,
        model: value.model,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, name, provider, model")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not create API profile.");
    }

    const createdProfile: ApiProfile = {
      id: data.id,
      name: data.name,
      provider: data.provider,
      model: data.model,
      apiKey: value.apiKey,
    };

    setProfiles((prev) => [createdProfile, ...prev]);
  }, [user]);

  const handleUpdateProfile = useCallback(async (id: string, value: Omit<ApiProfile, "id">) => {
    if (!user) {
      throw new Error("You must be signed in to update API profiles.");
    }

    const { data, error } = await supabase
      .from("api_profiles")
      .update({
        name: value.name,
        provider: value.provider,
        model: value.model,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, provider, model")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not update API profile.");
    }

    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === id
          ? {
              ...profile,
              name: data.name,
              provider: data.provider,
              model: data.model,
              apiKey: value.apiKey,
            }
          : profile,
      ),
    );
  }, [user]);

  const handleDeleteProfile = useCallback(async (id: string) => {
    if (!user) {
      throw new Error("You must be signed in to delete API profiles.");
    }

    const { error } = await supabase
      .from("api_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    setProfiles((prev) => prev.filter((profile) => profile.id !== id));
  }, [user]);

  return (
    <section className="space-y-5">
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "api" && (
        <ApiProfileList
          profiles={user ? profiles : []}
          onCreateProfile={handleCreateProfile}
          onUpdateProfile={handleUpdateProfile}
          onDeleteProfile={handleDeleteProfile}
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
            RP Chat MVP. Chat data, API profiles, and per-user BYOK provider keys persist in
            Supabase.
          </div>
        </section>
      )}
    </section>
  );
}
