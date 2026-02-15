interface PresetCardProps {
  name: string;
  onClick: () => void;
  isAddCard?: boolean;
}

export function PresetCard({ name, onClick, isAddCard = false }: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex aspect-square w-28 flex-col items-center justify-center rounded-2xl px-3 text-center transition sm:w-32 ${
        isAddCard
          ? "border border-dashed border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
          : "bg-zinc-900/70 text-zinc-200 hover:bg-zinc-800/80"
      }`}
    >
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full text-sm ${
          isAddCard
            ? "bg-zinc-800/80 text-zinc-300"
            : "bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700"
        }`}
      >
        {isAddCard ? "+" : "AI"}
      </div>
      <span className="line-clamp-2 text-xs font-medium leading-4">{name}</span>
    </button>
  );
}
