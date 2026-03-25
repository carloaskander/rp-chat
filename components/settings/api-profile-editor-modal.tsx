"use client";

import { CSSProperties, FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, X } from "lucide-react";

import { fetchProviderModels } from "@/lib/provider-models";
import { ProviderBrandIcon } from "@/components/ui/provider-brand-icon";
import { ApiProfile } from "@/types/settings";

interface ApiProfileEditorModalProps {
  open: boolean;
  title: string;
  initialValue: Omit<ApiProfile, "id">;
  apiKeyHint?: string;
  apiKeyPlaceholder?: string;
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

const safariRadiusFix: CSSProperties = {
  WebkitMaskImage: "-webkit-radial-gradient(white, black)",
  WebkitTransform: "translateZ(0)",
};

const fieldClassName =
  "h-11 w-full rounded-[8px] bg-zinc-900 px-3 text-sm leading-[1.25] text-zinc-100 outline-none placeholder:text-zinc-500";

const selectFieldClassName =
  "h-11 w-full appearance-none rounded-[8px] border-0 bg-zinc-900 pl-11 pr-10 text-sm leading-[1.25] text-zinc-100 outline-none ring-0 shadow-none [-webkit-appearance:none]";

const safariFieldClassName =
  "h-11 w-full rounded-[10px] bg-zinc-900 px-3 text-sm leading-[1.25] text-zinc-100 outline-none placeholder:text-zinc-500";

const safariSelectFieldClassName =
  "h-11 w-full appearance-none rounded-[10px] border-0 bg-zinc-900 pl-11 pr-10 text-sm leading-[1.25] text-zinc-100 outline-none ring-0 shadow-none [-webkit-appearance:none]";

export function ApiProfileEditorModal({
  open,
  title,
  initialValue,
  apiKeyHint,
  apiKeyPlaceholder = "sk-...",
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
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const ua = navigator.userAgent;
    const safari = /Safari/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua);
    setIsSafari(safari);
  }, []);

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

  const roundedFieldStyle = isSafari ? safariRadiusFix : undefined;
  const activeFieldClassName = isSafari ? safariFieldClassName : fieldClassName;
  const activeSelectFieldClassName = isSafari ? safariSelectFieldClassName : selectFieldClassName;
  const footerClassName = isSafari
    ? "mt-10 pt-2 flex items-center justify-end gap-2"
    : "mt-8 flex items-center justify-end gap-2";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4">
      <button type="button" aria-label="Close API profile editor" onClick={onCancel} className="absolute inset-0" />
      <form
        key={`${title}-${initialValue.name}-${initialValue.provider}-${initialValue.model}`}
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-[28px] bg-zinc-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl shadow-black/40 max-h-[calc(100dvh-1rem)] sm:w-[42rem] sm:max-w-[calc(100vw-2rem)] sm:max-h-[min(90dvh,42rem)] sm:rounded-[10px] sm:px-6 sm:pb-6 sm:pt-6"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700 sm:hidden" />

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

        <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-0.5 pb-2">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Profile Name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My OpenAI"
              className={activeFieldClassName}
              style={roundedFieldStyle}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Provider
            </label>
            <div className={`relative overflow-hidden ${isSafari ? "rounded-[10px]" : "rounded-[8px]"}`} style={roundedFieldStyle}>
              <span className="pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-zinc-400">
                <ProviderBrandIcon provider={provider} className="h-3.5 w-3.5" />
              </span>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className={activeSelectFieldClassName}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!isSafari ? (
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              ) : null}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={apiKeyPlaceholder}
              className={activeFieldClassName}
              style={roundedFieldStyle}
            />
            {apiKeyHint ? <p className="mt-2 text-xs text-zinc-500">{apiKeyHint}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Model
            </label>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              <div className="min-w-0 flex-1">
                {models.length > 0 ? (
                  <div className={`relative overflow-hidden ${isSafari ? "rounded-[10px]" : "rounded-[8px]"}`} style={roundedFieldStyle}>
                    <select
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className={activeSelectFieldClassName}
                    >
                      <option value="">Select model</option>
                      {models.map((modelId) => (
                        <option key={modelId} value={modelId}>
                          {modelId}
                        </option>
                      ))}
                    </select>
                    {!isSafari ? (
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    ) : null}
                  </div>
                ) : (
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="Enter model id"
                    className={activeFieldClassName}
                    style={roundedFieldStyle}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => void loadModels(provider, apiKey)}
                disabled={modelsLoading}
                className={`inline-flex h-11 w-full shrink-0 items-center justify-center gap-1 bg-zinc-900 px-3 text-sm leading-[1.25] text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${isSafari ? "rounded-[10px]" : "rounded-[8px]"}`}
                style={roundedFieldStyle}
              >
                {modelsLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                <span>{modelsLoading ? "Loading..." : "Fetch models"}</span>
              </button>
            </div>
            {modelsError && <p className="mt-2 text-xs text-zinc-500">{modelsError}</p>}
          </div>
        </div>

        <div className={footerClassName}>
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
