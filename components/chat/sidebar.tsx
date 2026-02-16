import { KeyboardEvent, useState } from "react";

import { ChatSession, SidebarView } from "@/types/chat";

import { formatChatDate } from "@/lib/chat-utils";
import { ChatActionsMenu } from "./chat-actions-menu";

interface SidebarProps {
  activeView: SidebarView;
  chats: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onViewChange: (view: SidebarView) => void;
  onSelectChat: (chatId: string) => void;
  onEditChatSettings: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => void;
  className?: string;
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
  onEditChatSettings,
  onDeleteChat,
  onRenameChat,
  className,
}: SidebarProps) {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const startRename = (chatId: string, currentTitle: string) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const cancelRename = () => {
    setEditingChatId(null);
    setEditingTitle("");
  };

  const saveRename = (chatId: string, fallbackTitle: string) => {
    const nextTitle = editingTitle.trim() || fallbackTitle || "Untitled Chat";
    onRenameChat(chatId, nextTitle);
    setEditingChatId(null);
    setEditingTitle("");
  };

  const handleRenameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    chatId: string,
    fallbackTitle: string,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveRename(chatId, fallbackTitle);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  return (
    <aside className={className ?? "flex h-full w-full max-w-72 flex-col px-2 py-2"}>
      <div className="p-2">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full rounded-xl bg-zinc-800/80 px-3 py-3 text-base sm:py-2.5 sm:text-sm font-medium text-zinc-100 transition hover:bg-zinc-700/80"
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
                className={`w-full rounded-lg px-3 py-2.5 text-left text-[15px] sm:py-2 sm:text-sm transition ${
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
            const isEditing = editingChatId === chat.id;
            return (
              <div
                key={chat.id}
                className={`group flex items-start gap-1 rounded-lg px-1 py-1 transition ${
                  isActive ? "bg-zinc-800/90 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900/70"
                }`}
              >
                {isEditing ? (
                  <div className="min-w-0 flex-1 px-2 py-1">
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={() => saveRename(chat.id, chat.title)}
                      onKeyDown={(event) =>
                        handleRenameKeyDown(event, chat.id, chat.title)
                      }
                      className="w-full bg-transparent px-2 py-1 text-sm font-medium text-zinc-100 outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectChat(chat.id)}
                    className="min-w-0 flex-1 px-2 py-1 text-left"
                  >
                    <p className="truncate text-[15px] font-medium sm:text-sm">{chat.title}</p>
                    <p
                      className={`mt-0.5 text-xs ${isActive ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {formatChatDate(chat.updatedAt)}
                    </p>
                  </button>
                )}
                <ChatActionsMenu
                  onRenameChat={() => startRename(chat.id, chat.title)}
                  onEditChatSettings={() => onEditChatSettings(chat.id)}
                  onDeleteChat={() => onDeleteChat(chat.id)}
                  triggerClassName="opacity-0 group-hover:opacity-100 focus:opacity-100"
                />
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
