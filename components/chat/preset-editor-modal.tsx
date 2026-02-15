"use client";

import { FormEvent, useState } from "react";

interface PresetEditorModalProps {
  open: boolean;
  title: string;
  initialName: string;
  initialContent: string;
  onSave: (name: string, content: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function PresetEditorModal({
  open,
  title,
  initialName,
  initialContent,
  onSave,
  onCancel,
  onDelete,
}: PresetEditorModalProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(name.trim() || "Untitled Preset", content);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-2xl bg-zinc-900 p-5 shadow-2xl shadow-black/40"
      >
        <h3 className="text-base font-medium text-zinc-100">{title}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Preset name"
              className="w-full rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Instructions
            </label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              placeholder="Write preset instructions"
              className="w-full resize-y rounded-xl bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
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
        </div>
      </form>
    </div>
  );
}
