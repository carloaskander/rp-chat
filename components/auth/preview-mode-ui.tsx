interface PreviewModeBadgeProps {
  className?: string;
}

export function PreviewModeBadge({ className }: PreviewModeBadgeProps) {
  return (
    <span
      className={`rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500 ${className ?? ""}`.trim()}
    >
      Preview mode
    </span>
  );
}

interface PreviewModeNoticeProps {
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function PreviewModeNotice({
  title = "Preview mode",
  description,
  actionLabel,
  onAction,
  className,
}: PreviewModeNoticeProps) {
  return (
    <div className={`rounded-[18px] border border-zinc-800 bg-zinc-900/60 p-4 text-sm ${className ?? ""}`.trim()}>
      <p className="font-medium text-zinc-200">{title}</p>
      <p className="mt-1 text-zinc-400">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center rounded-[16px] border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
