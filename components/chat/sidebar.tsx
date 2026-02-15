import { ChatSession, SidebarView } from "@/types/chat";

import { formatChatDate } from "@/lib/chat-utils";

interface SidebarProps {
  activeView: SidebarView;
  chats: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onViewChange: (view: SidebarView) => void;
  onSelectChat: (chatId: string) => void;
}

const navItems: Array<{ key: SidebarView; label: string }> = [
  { key: "instructionPresets", label: "Instruction Presets" },
  { key: "characterPresets", label: "Character Presets" },
];

export function Sidebar({
  activeView,
  chats,
  activeChatId,
  onNewChat,
  onViewChange,
  onSelectChat,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-full max-w-72 flex-col px-2 py-2">
      <div className="p-2">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full rounded-xl bg-zinc-800/80 px-3 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700/80"
        >
          New Chat
        </button>
      </div>

      <nav className="p-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onViewChange(item.key)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <section className="min-h-0 flex-1 px-2 pb-2 pt-3">
        <h2 className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Session Chats
        </h2>
        <div className="space-y-1 overflow-y-auto pr-1">
          {chats.length === 0 && (
            <p className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-500">
              No chats yet.
            </p>
          )}
          {chats.map((chat) => {
            const isActive = activeChatId === chat.id;
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelectChat(chat.id)}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  isActive
                    ? "bg-zinc-800/90 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-200"
                }`}
              >
                <p className="truncate text-sm font-medium">{chat.title}</p>
                <p className={`mt-0.5 text-xs ${isActive ? "text-zinc-400" : "text-zinc-500"}`}>
                  {formatChatDate(chat.updatedAt)}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
