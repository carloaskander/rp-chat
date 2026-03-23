"use client";

import Link from "next/link";
import { Check, Plus, X } from "lucide-react";

interface SelectorOption {
  id: string;
  label: string;
  description?: string;
}

export interface SelectorAnchorRect {
  top: number;
  left: number;
  bottom: number;
  width: number;
  height: number;
}

interface ChatOptionSelectorModalProps {
  open: boolean;
  title: string;
  description: string;
  selectedId: string | null;
  options: SelectorOption[];
  anchorRect?: SelectorAnchorRect | null;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  settingsHref?: string;
  createHref?: string;
  createLabel?: string;
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
  anchorRect,
  emptyStateTitle = "No options available yet.",
  emptyStateDescription,
  settingsHref,
  createHref,
  createLabel,
  allowNone = false,
  noneLabel = "None",
  onClose,
  onSelect,
}: ChatOptionSelectorModalProps) {
  if (!open) {
    return null;
  }

  const hasOptions = options.length > 0;
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 640;
  const desktopWidth = 360;
  const canAnchorToTrigger = Boolean(isDesktop && anchorRect);
  const desktopLeft = canAnchorToTrigger
    ? Math.min(Math.max(16, anchorRect!.left), window.innerWidth - desktopWidth - 16)
    : null;
  const shouldOpenBelow = canAnchorToTrigger ? anchorRect!.top < 240 : false;
  const desktopTop = canAnchorToTrigger
    ? shouldOpenBelow
      ? Math.min(window.innerHeight - 24, anchorRect!.bottom + 10)
      : Math.max(16, anchorRect!.top - 10)
    : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end bg-black/45 sm:bg-transparent ${
        canAnchorToTrigger ? "sm:block" : "sm:items-center sm:justify-center sm:p-4"
      }`}
    >
      <button
        type="button"
        aria-label="Close selector"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div
        className={`relative z-10 w-full rounded-t-[28px] bg-zinc-950 px-4 pb-4 pt-4 shadow-2xl shadow-black/50 sm:w-[22.5rem] sm:rounded-[10px] sm:px-5 sm:pb-5 sm:pt-5 ${
          canAnchorToTrigger ? "sm:absolute" : "sm:max-w-md"
        }`}
        style={
          canAnchorToTrigger
            ? {
                left: desktopLeft ?? undefined,
                top: desktopTop ?? undefined,
                transform: shouldOpenBelow ? undefined : "translateY(-100%)",
              }
            : undefined
        }
      >
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
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
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
                  className={`flex w-full items-center justify-between rounded-[10px] px-4 py-3 text-left transition ${
                    selectedId === null
                      ? "bg-zinc-900 text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
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
                    className={`flex w-full items-center justify-between rounded-[10px] px-4 py-3 text-left transition ${
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

              {createHref && createLabel && (
                <Link
                  href={createHref}
                  onClick={onClose}
                  className="flex w-full items-center justify-between rounded-[10px] px-4 py-3 text-left text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Plus className="h-4 w-4 shrink-0" />
                    {createLabel}
                  </span>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-[10px] bg-zinc-950/70 px-4 py-5 text-center">
              <p className="text-sm font-medium text-zinc-100">{emptyStateTitle}</p>
              {emptyStateDescription && (
                <p className="mt-1 text-xs leading-5 text-zinc-500">{emptyStateDescription}</p>
              )}
              {settingsHref && (
                <Link
                  href={settingsHref}
                  onClick={onClose}
                  className="mt-4 inline-flex rounded-[10px] bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
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
