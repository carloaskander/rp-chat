"use client";

import { ChangeEvent } from "react";

import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { DEFAULT_SETTINGS, PROVIDER_MODELS } from "@/lib/mock-data";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export function SettingsForm() {
  const [settings, setSettings] = useLocalStorageState(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS,
  );

  const availableModels = PROVIDER_MODELS[settings.provider];

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const provider = event.target.value as keyof typeof PROVIDER_MODELS;
    const nextModels = PROVIDER_MODELS[provider];

    setSettings((prev) => ({
      ...prev,
      provider,
      model: nextModels.includes(prev.model) ? prev.model : nextModels[0],
    }));
  };

  return (
    <section className="p-5 sm:p-6">
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="api-key">
            API Key
          </label>
          <input
            id="api-key"
            type="password"
            value={settings.apiKey}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, apiKey: event.target.value }))
            }
            placeholder="Paste API key"
            className="w-full rounded-xl bg-zinc-900/70 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Stored locally in your browser for this MVP.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="provider">
            Provider
          </label>
          <select
            id="provider"
            value={settings.provider}
            onChange={handleProviderChange}
            className="w-full rounded-xl bg-zinc-900/70 px-3 py-2.5 text-sm text-zinc-100 outline-none"
          >
            {Object.keys(PROVIDER_MODELS).map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="model">
            Model
          </label>
          <select
            id="model"
            value={settings.model}
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, model: event.target.value }))
            }
            className="w-full rounded-xl bg-zinc-900/70 px-3 py-2.5 text-sm text-zinc-100 outline-none"
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
