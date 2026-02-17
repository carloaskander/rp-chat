import { ChatSession } from "@/types/chat";

import { formatChatDate } from "@/lib/chat-utils";

interface HistoryPanelProps {
  chats: ChatSession[];
  activeChatId: string | null;
  onOpenChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export function HistoryPanel({
  chats,
  activeChatId,
  onOpenChat,
  onDeleteChat,
}: HistoryPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <header className="px-8 pb-4 pt-7">
        <h2 className="text-base font-medium tracking-tight text-zinc-100">Chat History</h2>
        <p className="mt-1 text-xs text-zinc-500">Session-only local history</p>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-8 pb-8 pt-4">
        {chats.length === 0 && (
          <div className="rounded-[2px] bg-zinc-900/70 p-4 text-sm text-zinc-500">
            No chats yet.
          </div>
        )}

        {chats.map((chat) => {
          const isActive = chat.id === activeChatId;

          return (
            <article
              key={chat.id}
              className={`rounded-[2px] p-4 ${isActive ? "bg-zinc-800/80" : "bg-zinc-900/70"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-zinc-100">{chat.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {chat.messages.length} messages - {formatChatDate(chat.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenChat(chat.id)}
                    className="rounded-[2px] bg-zinc-800/90 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700/90"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteChat(chat.id)}
                    className="rounded-[2px] bg-zinc-800/90 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700/90 hover:text-zinc-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
