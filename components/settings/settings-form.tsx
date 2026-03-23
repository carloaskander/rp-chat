"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleUserRound, Info, Palette, Settings2 } from "lucide-react";

import { PreviewModeNotice } from "@/components/auth/preview-mode-ui";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { ApiProfile, SettingsTab } from "@/types/settings";

import { ApiProfileList } from "./api-profile-list";
import { SettingsTabs } from "./settings-tabs";

interface SettingsFormProps {
  initialTab: SettingsTab;
}

export function SettingsForm({ initialTab }: SettingsFormProps) {
  const { user, isPreviewMode, requireAuth, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadProfiles = async () => {
      const { data, error } = await supabase
        .from("api_profiles")
        .select("id, name, provider, model, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to load API profiles from Supabase.", error);
        return;
      }

      const nextProfiles: ApiProfile[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        provider: row.provider,
        model: row.model,
        apiKey: "",
      }));
      setProfiles(nextProfiles);
    };

    void loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handlePersistApiKey = useCallback(
    async (params: { provider: string; apiKey: string }) => {
      if (!user) {
        throw new Error("You must be signed in to save provider API keys.");
      }

      const provider = params.provider.trim();
      const apiKey = params.apiKey.trim();

      if (!provider) {
        throw new Error("Provider is required.");
      }

      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError || !authData.session?.access_token) {
        throw new Error("Unable to resolve authenticated session.");
      }

      const response = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Could not save provider API key.",
        );
      }
    },
    [user],
  );

  const handleCreateProfile = useCallback(
    async (value: Omit<ApiProfile, "id">) => {
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
    },
    [user],
  );

  const handleUpdateProfile = useCallback(
    async (id: string, value: Omit<ApiProfile, "id">) => {
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
    },
    [user],
  );

  const handleDeleteProfile = useCallback(
    async (id: string) => {
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
    },
    [user],
  );

  return (
    <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="min-w-0 space-y-5 px-5 pb-6">
        {activeTab === "account" && (
          <section className="p-2">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-zinc-900 text-zinc-100">
                <CircleUserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-zinc-100">Account</h2>
                {isPreviewMode ? (
                  <PreviewModeNotice
                    description="Explore the app freely. Sign in when you're ready to save chats, configure providers, and use models."
                    actionLabel="Sign in"
                    onAction={requireAuth}
                    className="mt-1"
                  />
                ) : (
                  <>
                    <p className="mt-1 text-sm text-zinc-400">
                      You are signed in and ready to use the app.
                    </p>
                    <div className="mt-4 px-1 py-1">
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Email</p>
                      <p className="mt-1 truncate text-sm text-zinc-200">{user?.email ?? "Signed out"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      className="mt-4 inline-flex items-center rounded-none px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900/70 hover:text-zinc-100"
                    >
                      Log out
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "api" && (
          <section>
            <div className="flex items-start gap-3 px-5 py-4">
              <Settings2 className="mt-0.5 h-5 w-5 text-zinc-400" />
              <div>
                <h2 className="text-base font-medium text-zinc-100">API Profiles</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Manage model providers and saved keys for your account.
                </p>
              </div>
            </div>
            <ApiProfileList
              profiles={user ? profiles : []}
              isPreviewMode={isPreviewMode}
              onRequireAuth={requireAuth}
              onCreateProfile={handleCreateProfile}
              onUpdateProfile={handleUpdateProfile}
              onDeleteProfile={handleDeleteProfile}
              onPersistApiKey={handlePersistApiKey}
            />
          </section>
        )}

        {activeTab === "appearance" && (
          <section className="p-2">
            <div className="flex items-start gap-3">
              <Palette className="mt-0.5 h-5 w-5 text-zinc-400" />
              <div>
                <h2 className="text-base font-medium text-zinc-100">Appearance</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Theme and visual customization will live here soon.
                </p>
              </div>
            </div>
          </section>
        )}

        {activeTab === "about" && (
          <section className="p-2">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-zinc-400" />
              <div>
                <h2 className="text-base font-medium text-zinc-100">About</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  RP Chat MVP. Chat data, API profiles, and per-user BYOK provider keys persist in
                  Supabase.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
