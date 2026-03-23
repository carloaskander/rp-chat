import { KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookText,
  ChevronUp,
  CircleUserRound,
  Info,
  LogOut,
  Palette,
  PenSquare,
  Settings,
  Settings2,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { ChatSession, SidebarView } from "@/types/chat";

import { formatChatDate } from "@/lib/chat-utils";
import { ChatActionsMenu } from "./chat-actions-menu";

interface SidebarProps {
  activeView: SidebarView;
  chats: ChatSession[];
  activeChatId: string | null;
  isPreviewMode: boolean;
  onNewChat: () => void;
  onViewChange: (view: SidebarView) => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat: (chatId: string, title: string) => void;
  onRequireAuth: () => void;
  className?: string;
}

const navItems: Array<{ key: SidebarView; label: string; icon: LucideIcon }> = [
  { key: "instructionPresets", label: "Instruction Presets", icon: BookText },
  { key: "characterPresets", label: "Character Presets", icon: UserRound },
];

export function Sidebar({
  activeView,
  chats,
  activeChatId,
  isPreviewMode,
  onNewChat,
  onViewChange,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onRequireAuth,
  className,
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const userEmail = user?.email?.trim() ?? "Signed in";
  const userName =
    typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : userEmail.split("@")[0] ?? "Account";
  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "";
  const avatarFallback = userName.slice(0, 1).toUpperCase() || "A";

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
    event: ReactKeyboardEvent<HTMLInputElement>,
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

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountMenuOpen]);

  const renderAvatar = (sizeClass: string) => {
    if (isPreviewMode) {
      return (
        <div
          aria-hidden="true"
          className={`${sizeClass} shrink-0 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400`}
        >
          <CircleUserRound className="h-4.5 w-4.5" />
        </div>
      );
    }

    if (avatarUrl) {
      return (
        <div
          aria-hidden="true"
          className={`${sizeClass} shrink-0 rounded-full bg-zinc-800 bg-cover bg-center bg-no-repeat`}
          style={{ backgroundImage: `url(${avatarUrl})` }}
        />
      );
    }

    return (
      <div
        aria-hidden="true"
        className={`${sizeClass} shrink-0 flex items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-100`}
      >
        {avatarFallback}
      </div>
    );
  };

  const sidebarButtonClassName = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left text-[15px] transition sm:py-2.5 sm:text-sm ${
      isActive
        ? "bg-zinc-900/80 text-zinc-100"
        : "text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-200"
    }`;

  return (
    <aside className={className ?? "flex h-full w-full max-w-72 flex-col px-2 py-2"}>
      <div className="px-3 pb-2 pt-1 md:hidden">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-medium tracking-tight text-zinc-100">RP Chat MVP</h1>
          <p className="truncate text-xs text-zinc-400">Your private roleplay hub</p>
        </div>
      </div>

      <nav className="p-2">
        <div className="space-y-1">
          <button
            type="button"
            onClick={isPreviewMode ? onRequireAuth : onNewChat}
            className={`${sidebarButtonClassName(false)} ${
              ""
            }`}
          >
            <PenSquare className="h-4.5 w-4.5 shrink-0" />
            <span className="min-w-0 flex-1 font-medium">New Chat</span>
          </button>

          {navItems.map((item) => {
            const isActive = activeView === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onViewChange(item.key)}
                className={sidebarButtonClassName(isActive)}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span className="min-w-0 flex-1 font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <section className="min-h-0 flex-1 px-2 pb-2 pt-3">
        <h2 className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Session Chats
        </h2>
        <div className="h-full space-y-1 overflow-y-auto pr-1">
          {chats.length === 0 && (
            <p className="rounded-[10px] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-500">
              No chats yet.
            </p>
          )}
          {chats.map((chat) => {
            const isActive = activeChatId === chat.id;
            const isEditing = editingChatId === chat.id;
            return (
              <div
                key={chat.id}
                className={`group flex items-start gap-1 rounded-[10px] px-1 py-1 transition ${
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
                  onDeleteChat={() => onDeleteChat(chat.id)}
                  triggerClassName="opacity-0 group-hover:opacity-100 focus:opacity-100"
                />
              </div>
            );
          })}
        </div>
      </section>

      <div className="relative border-t border-zinc-900/90 px-3 pb-3 pt-3" ref={accountMenuRef}>
        {isAccountMenuOpen && (
          <div className="absolute inset-x-3 bottom-[calc(100%+0.35rem)] rounded-[10px] bg-zinc-950/98 p-2 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center gap-3 rounded-[10px] px-3 py-3">
              {renderAvatar("h-11 w-11")}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {isPreviewMode ? "Preview mode" : userName}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {isPreviewMode ? "Explore the app and open settings sections" : userEmail}
                </p>
              </div>
            </div>

            <div className="my-2 h-px bg-zinc-800" />

            <Link
              href="/settings?section=account"
              onClick={() => setIsAccountMenuOpen(false)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <CircleUserRound className="h-4 w-4" />
              <span>Account</span>
            </Link>

            <Link
              href="/settings?section=api"
              onClick={() => setIsAccountMenuOpen(false)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <Settings2 className="h-4 w-4" />
              <span>API Profiles</span>
            </Link>

            <Link
              href="/settings?section=appearance"
              onClick={() => setIsAccountMenuOpen(false)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <Palette className="h-4 w-4" />
              <span>Appearance</span>
            </Link>

            <Link
              href="/settings?section=about"
              onClick={() => setIsAccountMenuOpen(false)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <Info className="h-4 w-4" />
              <span>About</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setIsAccountMenuOpen(false)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              <Settings className="h-4 w-4" />
              <span>All Settings</span>
            </Link>

            {isPreviewMode ? (
              <button
                type="button"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  onRequireAuth();
                }}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                <CircleUserRound className="h-4 w-4" />
                <span>Sign in</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsAccountMenuOpen((prev) => !prev)}
          className="flex w-full items-center gap-3 rounded-[10px] bg-zinc-900/80 px-3 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          {renderAvatar("h-10 w-10")}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">
              {isPreviewMode ? "Preview mode" : userName}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {isPreviewMode ? "Explore the app before signing in" : userEmail}
            </p>
          </div>
          <ChevronUp
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
              isAccountMenuOpen ? "rotate-180 text-zinc-300" : ""
            }`}
          />
        </button>
      </div>
    </aside>
  );
}
