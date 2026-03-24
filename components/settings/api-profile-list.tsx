"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/lib/supabase";
import { ApiProfile } from "@/types/settings";

import { ApiProfileEditorModal } from "./api-profile-editor-modal";
import { ProviderBrandIcon } from "../ui/provider-brand-icon";

interface ApiProfileListProps {
  profiles: ApiProfile[];
  status: "idle" | "loading" | "loaded" | "empty" | "error";
  errorMessage?: string | null;
  isPreviewMode?: boolean;
  onRequireAuth?: () => void;
  onCreateProfile: (value: Omit<ApiProfile, "id">) => Promise<void>;
  onUpdateProfile: (id: string, value: Omit<ApiProfile, "id">) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onPersistApiKey: (params: { provider: string; apiKey: string }) => Promise<void>;
}

const emptyDraft: Omit<ApiProfile, "id"> = {
  name: "",
  provider: "OpenAI",
  model: "",
  apiKey: "",
};

export function ApiProfileList({
  profiles,
  status,
  errorMessage = null,
  isPreviewMode = false,
  onRequireAuth,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onPersistApiKey,
}: ApiProfileListProps) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [validatingProfileId, setValidatingProfileId] = useState<string | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const editingProfile = profiles.find((profile) => profile.id === editingProfileId) ?? null;
  const isModalOpen = !isPreviewMode && (isCreating || editingProfile !== null);

  const handleDeleteProfile = async (profileId: string) => {
    setActionError(null);
    setDeletingProfileId(profileId);
    try {
      await onDeleteProfile(profileId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not delete profile.");
    } finally {
      setDeletingProfileId(null);
    }
  };

  const handleValidateProfile = async (profile: ApiProfile) => {
    setValidatingProfileId(profile.id);

    try {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError || !authData.session?.access_token) {
        throw new Error("Unable to resolve authenticated session.");
      }

      const response = await fetch("/api/keys/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          provider: profile.provider,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Could not validate API profile.",
        );
      }

      setValidationResults((prev) => ({
        ...prev,
        [profile.id]: {
          ok: Boolean(payload?.ok),
          message:
            typeof payload?.message === "string"
              ? payload.message
              : "Could not validate API profile.",
        },
      }));
    } catch (error) {
      setValidationResults((prev) => ({
        ...prev,
        [profile.id]: {
          ok: false,
          message: error instanceof Error ? error.message : "Could not validate API profile.",
        },
      }));
    } finally {
      setValidatingProfileId(null);
    }
  };

  return (
    <section className="px-5 pb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-100">API Profiles</h2>
        <button
          type="button"
          onClick={() => {
            if (isPreviewMode) {
              onRequireAuth?.();
              return;
            }
            setIsCreating(true);
            setEditingProfileId(null);
          }}
          className={`rounded-[10px] px-3 py-1.5 text-xs font-medium transition ${
            isPreviewMode
              ? "bg-zinc-900/60 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              : "bg-zinc-900/80 text-zinc-200 hover:bg-zinc-900 hover:text-zinc-100"
          }`}
        >
          Add API Profile
        </button>
      </div>

      {status === "loading" ? (
        <div className="rounded-[10px] p-4 text-sm text-zinc-400">Loading API profiles...</div>
      ) : status === "error" ? (
        <div className="rounded-[10px] p-4 text-sm text-rose-400">{errorMessage ?? "Could not load API profiles."}</div>
      ) : profiles.length === 0 ? (
        <div className="rounded-[10px] p-4 text-sm text-zinc-400">
          {isPreviewMode
            ? "Your saved provider profiles will appear here once you sign in."
            : "No API profiles yet. Add your first profile to continue."}
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => {
            const validation = validationResults[profile.id];
            const isValidating = validatingProfileId === profile.id;

            return (
              <article
                key={profile.id}
                className="flex items-center justify-between rounded-[10px] px-3 py-2.5 transition hover:bg-zinc-900/30"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-zinc-900 text-zinc-200">
                    <ProviderBrandIcon provider={profile.provider} className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-zinc-100">{profile.name}</p>
                    <p className="truncate text-[11px] text-zinc-400">
                      {profile.provider} - {profile.model || "No model"}
                    </p>
                    {validation && (
                      <p
                        className={`mt-1 text-[11px] ${validation.ok ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {validation.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-3 flex items-center gap-1.5 md:gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isPreviewMode) {
                        onRequireAuth?.();
                        return;
                      }
                      void handleValidateProfile(profile);
                    }}
                    disabled={isValidating}
                    className="rounded-[10px] px-2 py-1 text-[11px] text-zinc-300 transition hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isValidating ? "Validating..." : "Validate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPreviewMode) {
                        onRequireAuth?.();
                        return;
                      }
                      setIsCreating(false);
                      setEditingProfileId(profile.id);
                    }}
                    className="rounded-[10px] px-2 py-1 text-[11px] text-zinc-300 transition hover:text-zinc-100"
                    aria-label={`Edit ${profile.name}`}
                    title={`Edit ${profile.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPreviewMode) {
                        onRequireAuth?.();
                        return;
                      }
                      void handleDeleteProfile(profile.id);
                    }}
                    disabled={deletingProfileId === profile.id}
                    className="rounded-[10px] px-2 py-1 text-[11px] text-rose-400 transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={deletingProfileId === profile.id ? `Deleting ${profile.name}` : `Delete ${profile.name}`}
                    title={`Delete ${profile.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {actionError && <p className="mt-3 text-sm text-rose-400">{actionError}</p>}

      <ApiProfileEditorModal
        key={isCreating ? "new-api-profile" : editingProfile?.id ?? "closed"}
        open={isModalOpen}
        title={isCreating ? "New API Profile" : "Edit API Profile"}
        apiKeyPlaceholder={isCreating ? "sk-..." : "Leave blank to keep current key"}
        apiKeyHint={
          isCreating ? undefined : "Leave this blank to keep the current saved key. Enter a new key only if you want to replace it."
        }
        initialValue={
          editingProfile
            ? {
                name: editingProfile.name,
                provider: editingProfile.provider,
                model: editingProfile.model,
                apiKey: "",
              }
            : emptyDraft
        }
        onCancel={() => {
          setIsCreating(false);
          setEditingProfileId(null);
        }}
        onSave={async (value) => {
          setActionError(null);

          if (isCreating) {
            await onCreateProfile(value);
          } else if (editingProfile) {
            await onUpdateProfile(editingProfile.id, value);
          }

          const trimmedApiKey = value.apiKey.trim();

          if (editingProfile && editingProfile.provider !== value.provider && !trimmedApiKey) {
            throw new Error("Enter a new API key when changing provider.");
          }

          if (trimmedApiKey) {
            await onPersistApiKey({
              provider: value.provider,
              apiKey: trimmedApiKey,
            });
          }

          setIsCreating(false);
          setEditingProfileId(null);
        }}
      />
    </section>
  );
}
