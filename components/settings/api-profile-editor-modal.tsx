"use client";

import { FormEvent, useState } from "react";

import { ApiProfile } from "@/types/settings";

interface ApiProfileEditorModalProps {
  open: boolean;
  title: string;
  initialValue: Omit<ApiProfile, "id">;
  onSave: (value: Omit<ApiProfile, "id">) => void;
  onCancel: () => void;
}

const providerOptions = ["OpenAI", "Grok", "Anthropic", "Google"];

export function ApiProfileEditorModal({
  open,
  title,
  initialValue,
  onSave,
  onCancel,
}: ApiProfileEditorModalProps) {
  const [name, setName] = useState(initialValue.name);
  const [provider, setProvider] = useState(initialValue.provider);
  const [model, setModel] = useState(initialValue.model);
  const [apiKey, setApiKey] = useState(initialValue.apiKey);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSave({
      name: name.trim() || "Untitled Profile",
      provider: provider.trim() || "OpenAI",
      model: model.trim(),
      apiKey,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        key={`${title}-${initialValue.name}-${initialValue.provider}-${initialValue.model}`}
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl bg-zinc-900 p-5"
      >
        <h3 className="text-base font-medium text-zinc-100">{title}</h3>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Profile Name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My OpenAI"
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Provider
            </label>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none"
            >
              {providerOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Model
            </label>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gpt-4.1-mini"
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
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
            className="rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-600"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}