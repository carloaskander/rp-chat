import { Preset } from "@/types/chat";

interface PresetEditorPanelProps {
  title: string;
  presets: Preset[];
  onAddPreset: () => void;
  onUpdatePreset: (presetId: string, updates: Partial<Preset>) => void;
  onDeletePreset: (presetId: string) => void;
}

export function PresetEditorPanel({
  title,
  presets,
  onAddPreset,
  onUpdatePreset,
  onDeletePreset,
}: PresetEditorPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-8 pb-4 pt-7">
        <h2 className="text-base font-medium tracking-tight text-zinc-100">{title}</h2>
        <button
          type="button"
          onClick={onAddPreset}
          className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
        >
          Add Preset
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-8 pb-8 pt-4">
        {presets.map((preset) => (
          <article key={preset.id} className="p-2">
            <div className="mb-3 flex items-center gap-2">
              <input
                value={preset.name}
                onChange={(event) =>
                  onUpdatePreset(preset.id, { name: event.target.value })
                }
                placeholder="Preset name"
                className="w-full rounded-[2px] bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={() => onDeletePreset(preset.id)}
                className="rounded-[2px] border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
              >
                Delete
              </button>
            </div>
            <textarea
              value={preset.content}
              onChange={(event) =>
                onUpdatePreset(preset.id, { content: event.target.value })
              }
              rows={4}
              placeholder="Preset prompt"
              className="w-full resize-y rounded-[2px] bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </article>
        ))}

        {presets.length === 0 && (
          <div className="rounded-[2px] bg-zinc-900/70 p-4 text-sm text-zinc-500">
            No presets yet.
          </div>
        )}
      </div>
    </section>
  );
}
