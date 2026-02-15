"use client";

import { useState } from "react";

import { createId } from "@/lib/chat-utils";
import { ApiProfile } from "@/types/settings";

import { ApiProfileEditorModal } from "./api-profile-editor-modal";

interface ApiProfileListProps {
  profiles: ApiProfile[];
  activeProfileId: string | null;
  onChangeProfiles: (profiles: ApiProfile[]) => void;
  onChangeActiveProfileId: (profileId: string | null) => void;
}

const emptyDraft: Omit<ApiProfile, "id"> = {
  name: "",
  provider: "OpenAI",
  model: "",
  apiKey: "",
};

export function ApiProfileList({
  profiles,
  activeProfileId,
  onChangeProfiles,
  onChangeActiveProfileId,
}: ApiProfileListProps) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const editingProfile = profiles.find((profile) => profile.id === editingProfileId) ?? null;
  const isModalOpen = isCreating || editingProfile !== null;

  const handleDeleteProfile = (profileId: string) => {
    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    onChangeProfiles(nextProfiles);

    if (activeProfileId === profileId) {
      onChangeActiveProfileId(nextProfiles[0]?.id ?? null);
    }
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
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Add API Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-xl bg-zinc-900/60 p-4 text-sm text-zinc-400">
          No API profiles yet. Add your first profile to continue.
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;

            return (
              <article
                key={profile.id}
                className={`flex items-center justify-between rounded-xl px-3 py-3 ${
                  isActive ? "bg-zinc-800/90" : "bg-zinc-900/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChangeActiveProfileId(profile.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-200">
                    API
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{profile.name}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {profile.provider} - {profile.model || "No model"}
                    </p>
                  </div>
                </button>

                <div className="ml-3 flex items-center gap-2">
                  {isActive && (
                    <span className="rounded-md bg-zinc-700 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-200">
                      Active
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingProfileId(profile.id);
                    }}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
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
        onSave={(value) => {
          if (isCreating) {
            const nextProfile: ApiProfile = {
              id: createId(),
              ...value,
            };
            const nextProfiles = [nextProfile, ...profiles];
            onChangeProfiles(nextProfiles);
            if (!activeProfileId) {
              onChangeActiveProfileId(nextProfile.id);
            }
          } else if (editingProfile) {
            const nextProfiles = profiles.map((profile) =>
              profile.id === editingProfile.id ? { ...profile, ...value } : profile,
            );
            onChangeProfiles(nextProfiles);
          }

          setIsCreating(false);
          setEditingProfileId(null);
        }}
      />
    </section>
  );
}