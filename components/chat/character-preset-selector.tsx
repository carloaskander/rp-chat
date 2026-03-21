"use client";

import { useState } from "react";

import { PreviewModeBadge } from "@/components/auth/preview-mode-ui";
import { Preset } from "@/types/chat";

import { PresetCard } from "./preset-card";
import { PresetEditorModal } from "./preset-editor-modal";

interface CharacterPresetSelectorProps {
  presets: Preset[];
  isReadOnly?: boolean;
  onRequireAuth?: () => void;
  onCreatePreset: (name: string, content: string) => void;
  onUpdatePreset: (presetId: string, updates: Partial<Preset>) => void;
  onDeletePreset: (presetId: string) => void;
}

export function CharacterPresetSelector({
  presets,
  isReadOnly = false,
  onRequireAuth,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
}: CharacterPresetSelectorProps) {
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? null;
  const modalOpen = isCreating || activePreset !== null;
  const handleBlockedAction = () => {
    onRequireAuth?.();
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <header className="px-8 pb-4 pt-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium tracking-tight text-zinc-100">Character Presets</h2>
          {isReadOnly && <PreviewModeBadge />}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-2">
        <div className="flex flex-wrap gap-3">
          <PresetCard
            name="Add Preset"
            isAddCard
            disabled={isReadOnly}
            onClick={isReadOnly ? handleBlockedAction : () => setIsCreating(true)}
          />
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              name={preset.name}
              disabled={isReadOnly}
              onClick={
                isReadOnly
                  ? handleBlockedAction
                  : () => {
                      setIsCreating(false);
                      setActivePresetId(preset.id);
                    }
              }
            />
          ))}
        </div>
      </div>

      <PresetEditorModal
        key={isCreating ? "create-character" : activePreset?.id ?? "character-closed"}
        open={!isReadOnly && modalOpen}
        title={isCreating ? "New Character Preset" : "Edit Character Preset"}
        initialName={activePreset?.name ?? ""}
        initialContent={activePreset?.content ?? ""}
        onCancel={() => {
          setIsCreating(false);
          setActivePresetId(null);
        }}
        onSave={(name, content) => {
          if (isCreating) {
            onCreatePreset(name, content);
          } else if (activePreset) {
            onUpdatePreset(activePreset.id, { name, content });
          }

          setIsCreating(false);
          setActivePresetId(null);
        }}
        onDelete={
          activePreset
            ? () => {
                onDeletePreset(activePreset.id);
                setIsCreating(false);
                setActivePresetId(null);
              }
            : undefined
        }
      />
    </section>
  );
}
