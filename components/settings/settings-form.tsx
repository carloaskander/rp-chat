"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, CircleUserRound, Info, Palette, Settings2 } from "lucide-react";

import { PreviewModeNotice } from "@/components/auth/preview-mode-ui";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { ApiProfile, SettingsTab } from "@/types/settings";

import { useApiProfiles } from "./api-profiles-provider";
import { ApiProfileList } from "./api-profile-list";
import { SettingsTabs, settingsTabs } from "./settings-tabs";

interface SettingsFormProps {
  initialTab: SettingsTab;
  startInDetail?: boolean;
}

export function SettingsForm({ initialTab, startInDetail = false }: SettingsFormProps) {
  const { user, isPreviewMode, requireAuth, signOut } = useAuth();
  const {
    profiles,
    status: apiProfilesStatus,
    errorMessage: apiProfilesError,
    createProfile,
    updateProfile,
    deleteProfile,
  } = useApiProfiles();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(startInDetail);

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
      await createProfile(value);
    },
    [createProfile],
  );

  const handleUpdateProfile = useCallback(
    async (id: string, value: Omit<ApiProfile, "id">) => {
      await updateProfile(id, value);
    },
    [updateProfile],
  );

  const handleDeleteProfile = useCallback(
    async (id: string) => {
      await deleteProfile(id);
    },
    [deleteProfile],
  );

  const handleTabChange = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
    setIsMobileDetailOpen(true);
  }, []);

  const renderActiveContent = () => (
    <div className="min-w-0 space-y-5 px-5 pb-6">
      {activeTab === "account" && (
        <section className="p-2">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-zinc-900 text-zinc-100">
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
                    className="mt-4 inline-flex items-center rounded-[10px] bg-zinc-900 px-4 py-2 text-sm font-medium text-rose-400 transition hover:bg-zinc-800 hover:text-rose-300"
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
            status={user ? apiProfilesStatus : "idle"}
            errorMessage={apiProfilesError}
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
  );

  return (
    <section>
      <div className="hidden gap-5 md:grid md:grid-cols-[280px_minmax(0,1fr)]">
        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {renderActiveContent()}
      </div>

      <div className="overflow-hidden md:hidden">
        <div
          className={`flex w-[200%] transition-transform duration-300 ease-out ${
            isMobileDetailOpen ? "-translate-x-1/2" : "translate-x-0"
          }`}
        >
          <div className="w-1/2 shrink-0">
            <div className="space-y-2 px-1">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className="flex w-full items-start gap-3 rounded-[10px] px-4 py-3 text-left text-zinc-300 transition hover:bg-zinc-900/70 hover:text-zinc-100"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{tab.label}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{tab.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-1/2 shrink-0">
            <div className="flex items-center gap-3 px-5 py-3">
              <button
                type="button"
                onClick={() => setIsMobileDetailOpen(false)}
                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-zinc-100"
                aria-label="Back to settings"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            </div>
            {renderActiveContent()}
          </div>
        </div>
      </div>
    </section>
  );
}
