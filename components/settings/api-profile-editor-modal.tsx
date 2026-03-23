"use client";

import { FormEvent, useCallback, useState } from "react";
import { ChevronDown, LoaderCircle, X } from "lucide-react";

import { fetchProviderModels } from "@/lib/provider-models";
import { ApiProfile } from "@/types/settings";

interface ApiProfileEditorModalProps {
  open: boolean;
  title: string;
  initialValue: Omit<ApiProfile, "id">;
  onSave: (value: Omit<ApiProfile, "id">) => Promise<void> | void;
  onCancel: () => void;
}

const providerOptions = [
  { value: "OpenAI", label: "OpenAI" },
  { value: "Kimi", label: "Kimi (Moonshot)" },
  { value: "Grok", label: "Grok" },
  { value: "Anthropic", label: "Anthropic" },
  { value: "Google", label: "Google" },
];

const fieldClassName =
  "h-11 w-full rounded-[8px] bg-zinc-900 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500";

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
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadModels = useCallback(async (providerValue: string, apiKeyValue: string) => {
    if (!open) {
      return;
    }

    if (!apiKeyValue.trim()) {
      setModels([]);
      setModelsError("Add API key to load provider models.");
      return;
    }

    setModelsLoading(true);
    setModelsError(null);
    try {
      const fetchedModels = await fetchProviderModels({
        name: "Temp",
        provider: providerValue,
        model: "",
        apiKey: apiKeyValue,
      });
      setModels(fetchedModels);
      setModel((prev) => (prev || fetchedModels[0] || prev));
    } catch (error) {
      setModels([]);
      setModelsError(error instanceof Error ? error.message : "Could not load models.");
    } finally {
      setModelsLoading(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    setIsSaving(true);

    try {
      await onSave({
        name: name.trim() || "Untitled Profile",
        provider: provider.trim() || "OpenAI",
        model: model.trim(),
        apiKey,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save API profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <button type="button" aria-label="Close API profile editor" onClick={onCancel} className="absolute inset-0" />
      <form
        key={`${title}-${initialValue.name}-${initialValue.provider}-${initialValue.model}`}
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-xl rounded-[10px] bg-zinc-950 p-5 shadow-2xl shadow-black/40 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-zinc-100">{title}</h3>
            <p className="mt-1 text-sm text-zinc-500">Set up a provider, model, and key for this profile.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Profile Name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My OpenAI"
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Provider
            </label>
            <div className="relative">
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className={`${fieldClassName} appearance-none pr-12 leading-none`}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-1 right-1 flex items-center rounded-[8px] bg-zinc-800/90 px-2 text-zinc-400">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Model
              </label>
              <button
                type="button"
                onClick={() => void loadModels(provider, apiKey)}
                disabled={modelsLoading}
                className="inline-flex items-center gap-1 rounded-[10px] bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {modelsLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{modelsLoading ? "Loading..." : "Fetch models"}</span>
              </button>
            </div>
            {models.length > 0 ? (
              <div className="relative">
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className={`${fieldClassName} appearance-none pr-12 leading-none`}
                >
                  <option value="">Select model</option>
                  {models.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-1 right-1 flex items-center rounded-[8px] bg-zinc-800/90 px-2 text-zinc-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            ) : (
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="Enter model id"
                className={fieldClassName}
              />
            )}
            {modelsError && <p className="mt-2 text-xs text-zinc-500">{modelsError}</p>}
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
              className={fieldClassName}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-[10px] bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
        {saveError && <p className="mt-3 text-sm text-rose-400">{saveError}</p>}
      </form>
    </div>
  );
}
