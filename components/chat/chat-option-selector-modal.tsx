"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

interface SelectorOption {
  id: string;
  label: string;
  description?: string;
}

interface ChatOptionSelectorModalProps {
  open: boolean;
  title: string;
  description: string;
  selectedId: string | null;
  options: SelectorOption[];
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  settingsHref?: string;
  allowNone?: boolean;
  noneLabel?: string;
  onClose: () => void;
  onSelect: (value: string | null) => void;
}

export function ChatOptionSelectorModal({
  open,
  title,
  description,
  selectedId,
  options,
  emptyStateTitle = "No options available yet.",
  emptyStateDescription,
  settingsHref,
  allowNone = false,
  noneLabel = "None",
  onClose,
  onSelect,
}: ChatOptionSelectorModalProps) {
  if (!open) {
    return null;
  }

  const hasOptions = options.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[1px] sm:items-center sm:justify-center sm:p-4">
      <button
        type="button"
        aria-label="Close selector"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative z-10 w-full rounded-t-[28px] border border-zinc-800 bg-zinc-950 px-4 pb-4 pt-4 shadow-2xl shadow-black/50 sm:max-w-md sm:rounded-[24px] sm:px-5 sm:pb-5 sm:pt-5">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-700 sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-zinc-100 sm:text-base">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-[min(60vh,26rem)] overflow-y-auto">
          {hasOptions || allowNone ? (
            <div className="space-y-2">
              {allowNone && (
                <button
                  type="button"
                  onClick={() => {
                    onSelect(null);
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition ${
                    selectedId === null
                      ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                      : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  <span className="text-sm font-medium">{noneLabel}</span>
                  {selectedId === null && <Check className="h-4 w-4 shrink-0 text-zinc-200" />}
                </button>
              )}

              {options.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onSelect(option.id);
                      onClose();
                    }}
                    className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                        : "border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-sm font-medium">{option.label}</p>
                      {option.description && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{option.description}</p>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-zinc-200" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[20px] border border-zinc-800 bg-zinc-950/70 px-4 py-5 text-center">
              <p className="text-sm font-medium text-zinc-100">{emptyStateTitle}</p>
              {emptyStateDescription && (
                <p className="mt-1 text-xs leading-5 text-zinc-500">{emptyStateDescription}</p>
              )}
              {settingsHref && (
                <Link
                  href={settingsHref}
                  onClick={onClose}
                  className="mt-4 inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
                >
                  Open Settings
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
