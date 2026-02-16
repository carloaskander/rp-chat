"use client";

import { FormEvent, useState } from "react";

import { Preset } from "@/types/chat";
import { ApiProfile } from "@/types/settings";

interface ChatSettingsValues {
  apiProfileId: string | null;
  characterPresetId: string | null;
  instructionPresetId: string | null;
}

interface ChatSettingsModalProps {
  open: boolean;
  title: string;
  initialValues: ChatSettingsValues;
  apiProfiles: ApiProfile[];
  characterPresets: Preset[];
  instructionPresets: Preset[];
  onSave: (values: ChatSettingsValues) => void;
  onCancel: () => void;
}

export function ChatSettingsModal({
  open,
  title,
  initialValues,
  apiProfiles,
  characterPresets,
  instructionPresets,
  onSave,
  onCancel,
}: ChatSettingsModalProps) {
  const [apiProfileId, setApiProfileId] = useState<string>(initialValues.apiProfileId ?? "");
  const [characterPresetId, setCharacterPresetId] = useState<string>(
    initialValues.characterPresetId ?? "",
  );
  const [instructionPresetId, setInstructionPresetId] = useState<string>(
    initialValues.instructionPresetId ?? "",
  );

  if (!open) {
    return null;
  }

  const canSave = apiProfileId.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) {
      return;
    }

    onSave({
      apiProfileId,
      characterPresetId,
      instructionPresetId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <form
        key={`${title}-${initialValues.apiProfileId ?? ""}-${initialValues.characterPresetId ?? ""}-${initialValues.instructionPresetId ?? ""}`}
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-zinc-100">{title}</h3>
            <p className="mt-1 text-xs text-zinc-500">
              API profile is required. Character and instruction presets are optional.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            x
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              API Profile
            </label>
            <select
              value={apiProfileId}
              onChange={(event) => setApiProfileId(event.target.value)}
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none"
            >
              <option value="">Select API profile</option>
              {apiProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ({profile.provider})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Character Preset
            </label>
            <select
              value={characterPresetId}
              onChange={(event) => setCharacterPresetId(event.target.value)}
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none"
            >
              <option value="">Select character preset</option>
              {characterPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Instruction Preset
            </label>
            <select
              value={instructionPresetId}
              onChange={(event) => setInstructionPresetId(event.target.value)}
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none"
            >
              <option value="">Select instruction preset</option>
              {instructionPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
