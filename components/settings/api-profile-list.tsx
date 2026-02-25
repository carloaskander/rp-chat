"use client";

import { useState } from "react";

import { createId } from "@/lib/chat-utils";
import { validateApiProfile } from "@/lib/profile-validation";
import { ApiProfile } from "@/types/settings";

import { ApiProfileEditorModal } from "./api-profile-editor-modal";

interface ApiProfileListProps {
  profiles: ApiProfile[];
  onChangeProfiles: (profiles: ApiProfile[]) => void;
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
  onChangeProfiles,
  onPersistApiKey,
}: ApiProfileListProps) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [validatingProfileId, setValidatingProfileId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const editingProfile = profiles.find((profile) => profile.id === editingProfileId) ?? null;
  const isModalOpen = isCreating || editingProfile !== null;

  const handleDeleteProfile = (profileId: string) => {
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    onChangeProfiles(nextProfiles);
  };

  const handleValidateProfile = async (profile: ApiProfile) => {
    setValidatingProfileId(profile.id);
    const result = await validateApiProfile(profile);
    setValidationResults((prev) => ({
      ...prev,
      [profile.id]: result,
    }));
    setValidatingProfileId(null);
  };

  return (
    <section className="px-5 pb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium text-zinc-100">API Profiles</h2>
        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setEditingProfileId(null);
          }}
          className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Add API Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-[2px] bg-zinc-900/60 p-4 text-sm text-zinc-400">
          No API profiles yet. Add your first profile to continue.
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => {
            const validation = validationResults[profile.id];
            const isValidating = validatingProfileId === profile.id;

            return (
            <article
              key={profile.id}
              className="flex items-center justify-between rounded-[2px] bg-zinc-900/60 px-3 py-3 transition hover:bg-zinc-800/70"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[2px] bg-zinc-700 text-xs font-semibold text-zinc-200">
                    API
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{profile.name}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {profile.provider} - {profile.model || "No model"}
                    </p>
                    {validation && (
                      <p
                        className={`mt-1 text-xs ${validation.ok ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {validation.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleValidateProfile(profile)}
                    disabled={isValidating}
                    className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isValidating ? "Validating..." : "Validate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingProfileId(profile.id);
                    }}
                    className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ApiProfileEditorModal
        key={isCreating ? "new-api-profile" : editingProfile?.id ?? "closed"}
        open={isModalOpen}
        title={isCreating ? "New API Profile" : "Edit API Profile"}
        initialValue={
          editingProfile
            ? {
                name: editingProfile.name,
                provider: editingProfile.provider,
                model: editingProfile.model,
                apiKey: editingProfile.apiKey,
              }
            : emptyDraft
        }
        onCancel={() => {
          setIsCreating(false);
          setEditingProfileId(null);
        }}
        onSave={async (value) => {
          if (isCreating) {
            const nextProfile: ApiProfile = {
              id: createId(),
              ...value,
            };
            const nextProfiles = [nextProfile, ...profiles];
            onChangeProfiles(nextProfiles);
          } else if (editingProfile) {
            const nextProfiles = profiles.map((profile) =>
              profile.id === editingProfile.id ? { ...profile, ...value } : profile,
            );
            onChangeProfiles(nextProfiles);
          }

          await onPersistApiKey({
            provider: value.provider,
            apiKey: value.apiKey,
          });

          setIsCreating(false);
          setEditingProfileId(null);
        }}
      />
    </section>
  );
}
