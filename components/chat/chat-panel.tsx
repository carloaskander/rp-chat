"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookText,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";

import { ProviderBrandIcon } from "@/components/ui/provider-brand-icon";
import { ChatMessage, ChatSession } from "@/types/chat";

import { SelectorAnchorRect } from "./chat-option-selector-modal";

interface ChatPanelProps {
  chat: ChatSession | null;
  modelLabel: string;
  apiProfileLabel: string;
  apiProfileProvider: string;
  characterPresetLabel: string;
  instructionPresetLabel: string;
  inputDisabled: boolean;
  authRequired: boolean;
  setupRequired: boolean;
  hasApiProfiles: boolean;
  isThinking: boolean;
  hasOlderMessages: boolean;
  isLoadingOlderMessages: boolean;
  onSendMessage: (content: string) => void;
  onRunSlashCommand: (commandId: string) => void | Promise<void>;
  onLoadOlderMessages: () => Promise<void>;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  onActivateMessageVersion: (targetVersionId: string) => Promise<void>;
  onOpenApiProfileSelector: (anchorRect?: SelectorAnchorRect) => void;
  onOpenCharacterPresetSelector: (anchorRect?: SelectorAnchorRect) => void;
  onOpenInstructionPresetSelector: (anchorRect?: SelectorAnchorRect) => void;
  onRequireAuth: () => void;
}

const SUMMARY_NOTICE_PREFIX = "[summary-notice]";
const SLASH_COMMANDS = [
  {
    id: "summarize",
    name: "summarize",
    label: "/summarize",
    description: "Summarize earlier messages now",
  },
] as const;

function isSummaryNotice(content: string): boolean {
  return content.startsWith(SUMMARY_NOTICE_PREFIX);
}

function formatSummaryNotice(content: string): string {
  return content.replace(SUMMARY_NOTICE_PREFIX, "").trim();
}

function formatCompactCharacterLabel(label: string): string {
  const trimmed = label.trim();

  if (trimmed.length <= 4) {
    return trimmed || "Char";
  }

  return `${trimmed.slice(0, 4)}...`;
}

interface SummaryNoticeProps {
  noticeText: string;
  summary: string | null | undefined;
  preservedMessagesForDev?: ChatSession["messages"];
}

function SummaryNotice({
  noticeText,
  summary,
  preservedMessagesForDev = [],
}: SummaryNoticeProps) {
  const [expanded, setExpanded] = useState(false);
  const [preservedExpanded, setPreservedExpanded] = useState(false);
  const canExpand = Boolean(summary?.trim());

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-[2px] border border-zinc-800/80 bg-zinc-900/55 px-3 py-2 text-xs text-zinc-400">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium tracking-wide text-zinc-400">{noticeText}</p>
          {canExpand && (
            <button
              type="button"
              onClick={() => {
                setExpanded((prev) => {
                  const next = !prev;
                  if (!next) {
                    setPreservedExpanded(false);
                  }
                  return next;
                });
              }}
              className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              <span>{expanded ? "Hide summary" : "View summary"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>

        {canExpand && (
          <div
            className={`grid transition-all duration-200 ease-out ${
              expanded ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-zinc-800/80 pt-2 text-sm leading-6 whitespace-pre-wrap text-zinc-300">
                {summary}
              </div>
              <div className="mt-2 border-t border-zinc-800/80 pt-2 text-left text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={() => setPreservedExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300"
                >
                  <span>
                    {preservedExpanded
                      ? "Hide preserved recent messages"
                      : "View preserved recent messages"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      preservedExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  className={`grid transition-all duration-200 ease-out ${
                    preservedExpanded
                      ? "mt-2 grid-rows-[1fr] opacity-100"
                      : "mt-0 grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    {preservedMessagesForDev.length > 0 ? (
                      <div className="space-y-2 border-t border-zinc-800/80 pt-2">
                        {preservedMessagesForDev.map((message) => (
                          <p key={message.id} className="leading-5 whitespace-pre-wrap">
                            <span className="font-medium text-zinc-300">
                              {message.role === "assistant" ? "Assistant" : "User"}:
                            </span>{" "}
                            {message.content}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="border-t border-zinc-800/80 pt-2 leading-5 text-zinc-500">
                        No preserved messages.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({
  chat,
  modelLabel,
  apiProfileLabel,
  apiProfileProvider,
  characterPresetLabel,
  instructionPresetLabel,
  inputDisabled,
  authRequired,
  setupRequired,
  hasApiProfiles,
  isThinking,
  hasOlderMessages,
  isLoadingOlderMessages,
  onSendMessage,
  onRunSlashCommand,
  onLoadOlderMessages,
  onEditMessage,
  onActivateMessageVersion,
  onOpenApiProfileSelector,
  onOpenCharacterPresetSelector,
  onOpenInstructionPresetSelector,
  onRequireAuth,
}: ChatPanelProps) {
  const TEXTAREA_MAX_HEIGHT = 168;
  const [inputValue, setInputValue] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(88);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const isLoadingOlderRef = useRef(false);
  const previousMessageRef = useRef<{
    chatId: string | null;
    firstMessageId: string | null;
    lastMessageId: string | null;
  }>({
    chatId: null,
    firstMessageId: null,
    lastMessageId: null,
  });

  const slashQuery = inputValue.startsWith("/") ? inputValue.slice(1).trim() : "";
  const isSlashMenuOpen =
    !authRequired &&
    !inputDisabled &&
    !isThinking &&
    inputValue.startsWith("/") &&
    !slashQuery.includes(" ");
  const filteredCommands = SLASH_COMMANDS.filter((command) =>
    command.name.toLowerCase().includes(slashQuery.toLowerCase()),
  );

  useEffect(() => {
    const previous = previousMessageRef.current;
    const nextChatId = chat?.id ?? null;
    const nextMessages = chat?.messages ?? [];
    const nextFirstMessageId = nextMessages[0]?.id ?? null;
    const nextLastMessageId = nextMessages[nextMessages.length - 1]?.id ?? null;

    const isChatSwitched = previous.chatId !== nextChatId;
    const isAppendedMessage =
      previous.chatId === nextChatId &&
      previous.lastMessageId !== nextLastMessageId &&
      previous.firstMessageId === nextFirstMessageId;

    if ((isChatSwitched || isAppendedMessage) && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    previousMessageRef.current = {
      chatId: nextChatId,
      firstMessageId: nextFirstMessageId,
      lastMessageId: nextLastMessageId,
    };
  }, [chat]);

  useEffect(() => {
    isLoadingOlderRef.current = isLoadingOlderMessages;
  }, [isLoadingOlderMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = async () => {
      if (container.scrollTop > 32) {
        return;
      }
      if (!hasOlderMessages || isLoadingOlderRef.current) {
        return;
      }

      isLoadingOlderRef.current = true;
      const previousScrollHeight = container.scrollHeight;
      const previousScrollTop = container.scrollTop;

      try {
        await onLoadOlderMessages();
      } finally {
        requestAnimationFrame(() => {
          const nextScrollHeight = container.scrollHeight;
          container.scrollTop = previousScrollTop + (nextScrollHeight - previousScrollHeight);
          isLoadingOlderRef.current = false;
        });
      }
    };

    const onScroll = () => {
      void handleScroll();
    };

    container.addEventListener("scroll", onScroll);

    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [hasOlderMessages, onLoadOlderMessages]);

  useEffect(() => {
    const formEl = formRef.current;
    if (!formEl || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      setInputBarHeight(formEl.offsetHeight);
    });

    observer.observe(formEl);
    setInputBarHeight(formEl.offsetHeight);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    const updateInset = () => {
      const occludedHeight = Math.max(
        0,
        window.innerHeight - (viewport.height + viewport.offsetTop),
      );
      setKeyboardInset(occludedHeight);
    };

    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    window.addEventListener("resize", updateInset);

    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      window.removeEventListener("resize", updateInset);
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }

    el.style.height = "0px";
    const nextHeight = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
    setIsComposerExpanded(nextHeight > 36);
  }, [inputValue]);

  useEffect(() => {
    if (!chat || !editingMessageId) {
      return;
    }

    const editingMessage = chat.messages.find((message) => message.id === editingMessageId);
    if (!editingMessage) {
      setEditingMessageId(null);
      setEditingValue("");
    }
  }, [chat, editingMessageId]);

  const executeSlashCommand = (commandId: string) => {
    void onRunSlashCommand(commandId);
    setInputValue("");
  };

  const handleInputChange = (nextValue: string) => {
    if (nextValue.startsWith("/") && nextValue !== inputValue) {
      setActiveCommandIndex(0);
    }
    setInputValue(nextValue);
  };

  const submitCurrentInput = () => {
    const trimmed = inputValue.trim();
    if (authRequired) {
      onRequireAuth();
      return false;
    }
    if (inputDisabled) {
      onOpenApiProfileSelector();
      return false;
    }
    if (isThinking) {
      return false;
    }
    if (!trimmed) {
      return false;
    }

    onSendMessage(trimmed);
    setInputValue("");
    return true;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitCurrentInput();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashMenuOpen && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const command = filteredCommands[activeCommandIndex];
      if (command) {
        executeSlashCommand(command.id);
      }
      return;
    }

    if (isSlashMenuOpen && filteredCommands.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommandIndex((prev) =>
          (prev - 1 + filteredCommands.length) % filteredCommands.length,
        );
        return;
      }
    }

    if (isSlashMenuOpen && event.key === "Escape") {
      event.preventDefault();
      setInputValue("");
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitCurrentInput();
    }
  };

  const handleStartEditingMessage = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingValue(message.content);
  };

  const handleCancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingValue("");
  };

  const getAnchorRect = (element: HTMLElement): SelectorAnchorRect => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  };

  const handleSubmitMessageEdit = async () => {
    if (!editingMessageId) {
      return;
    }

    const trimmed = editingValue.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmittingEdit(true);
    try {
      await onEditMessage(editingMessageId, trimmed);
      setEditingMessageId(null);
      setEditingValue("");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const controlButtonClassName =
    "inline-flex w-auto max-w-full items-center gap-1.5 px-1 py-1 text-left text-xs text-zinc-400 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="hidden items-start gap-3 px-8 pb-4 pt-7 md:flex">
        <div className="min-w-0">
          <p className="truncate text-base font-medium tracking-tight text-zinc-100">
            {chat?.title ?? "No Active Chat"}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-500">{modelLabel}</p>
        </div>
      </header>

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 w-full space-y-4 overflow-y-auto px-5 py-4 sm:mx-auto sm:max-w-3xl sm:px-8 sm:py-6 md:pb-6"
        style={{ paddingBottom: inputBarHeight + 16 }}
      >
        {isLoadingOlderMessages && (
          <div className="mx-auto w-full max-w-3xl text-center text-xs text-zinc-500">
            Loading older messages...
          </div>
        )}
        {setupRequired ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-sm text-zinc-400">
              {hasApiProfiles
                ? "Select an API profile to start chatting."
                : "Create an API profile first to start chatting."}
            </p>
            <button
              type="button"
              onClick={(event) => onOpenApiProfileSelector(getAnchorRect(event.currentTarget))}
              className="mt-4 rounded-[2px] border border-zinc-700 bg-zinc-800 px-4 py-2 text-[15px] font-medium text-zinc-200 hover:bg-zinc-700 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              {hasApiProfiles ? "Choose API Profile" : "Go to Settings"}
            </button>
          </div>
        ) : chat?.messages.length ? (
          chat.messages.map((message, index) =>
            (() => {
              const isTransportError =
                message.role === "assistant" &&
                message.content.startsWith("Request failed:");
              const isSummarySystemNotice =
                message.role === "assistant" &&
                isSummaryNotice(message.content);
              const canVersionSwitch =
                message.role === "user" && message.versions.length > 1;
              const previousVersion = message.versions[message.activeVersionIndex - 1] ?? null;
              const nextVersion = message.versions[message.activeVersionIndex + 1] ?? null;
              const isEditingThisMessage = editingMessageId === message.id;
              const canEditMessage =
                message.role === "user" && !isSummarySystemNotice && !isTransportError;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "w-full justify-start"
                  }`}
                >
                  {isSummarySystemNotice ? (
                    <SummaryNotice
                      noticeText={formatSummaryNotice(message.content)}
                      summary={chat?.storySummary}
                      preservedMessagesForDev={chat?.messages.slice(0, index)}
                    />
                  ) : message.role === "user" ? (
                    <div className="max-w-[88%] space-y-2 sm:max-w-[78%]">
                      <div className="rounded-2xl bg-zinc-800 px-4 py-3 text-[15px] leading-relaxed text-zinc-100 sm:text-sm">
                        {isEditingThisMessage ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingValue}
                              onChange={(event) => setEditingValue(event.target.value)}
                              rows={4}
                              disabled={isSubmittingEdit}
                              className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditingMessage}
                                disabled={isSubmittingEdit}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Cancel</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSubmitMessageEdit();
                                }}
                                disabled={isSubmittingEdit || !editingValue.trim()}
                                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>
                      {(canVersionSwitch || canEditMessage) && (
                        <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-500">
                          {canVersionSwitch && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (previousVersion) {
                                    void onActivateMessageVersion(previousVersion.id);
                                  }
                                }}
                                disabled={!previousVersion || isThinking}
                                aria-label="Show previous message version"
                                className="rounded-full p-1 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <span>
                                {message.activeVersionIndex + 1}/{message.versions.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (nextVersion) {
                                    void onActivateMessageVersion(nextVersion.id);
                                  }
                                }}
                                disabled={!nextVersion || isThinking}
                                aria-label="Show next message version"
                                className="rounded-full p-1 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {canEditMessage && (
                            <button
                              type="button"
                              onClick={() => handleStartEditingMessage(message)}
                              disabled={isThinking || isSubmittingEdit}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isTransportError ? (
                    <article className="w-full max-w-3xl rounded-xl border border-rose-500/50 bg-rose-950/30 px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-rose-200">
                      {message.content}
                    </article>
                  ) : (
                    <div className="w-full max-w-3xl space-y-2 px-1">
                      <article className="text-[15px] leading-7 whitespace-pre-wrap text-zinc-200">
                        {isEditingThisMessage ? (
                          <div className="max-w-3xl rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
                            <textarea
                              value={editingValue}
                              onChange={(event) => setEditingValue(event.target.value)}
                              rows={4}
                              disabled={isSubmittingEdit}
                              className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none"
                            />
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditingMessage}
                                disabled={isSubmittingEdit}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Cancel</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSubmitMessageEdit();
                                }}
                                disabled={isSubmittingEdit || !editingValue.trim()}
                                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          message.content
                        )}
                      </article>
                    </div>
                  )}
                </div>
              );
            })(),
          )
        ) : authRequired ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-sm text-zinc-400">
              Explore the interface in preview mode. Sign in to start chatting and save your story.
            </p>
            <button
              type="button"
              onClick={onRequireAuth}
              className="mt-4 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              Sign in to continue
            </button>
          </div>
        ) : (
          <div className="mx-auto mt-16 max-w-md text-center text-sm text-zinc-500">
            Send a message to begin this chat.
          </div>
        )}
        {isThinking && (
          <div className="w-full max-w-3xl px-1 text-[15px] leading-7 text-zinc-400">
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="fixed inset-x-0 z-20 shrink-0 w-full px-4 pt-2 sm:mx-auto sm:max-w-3xl sm:px-6 md:static md:px-6 md:pb-6"
        style={{
          bottom: keyboardInset,
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="relative">
        {isSlashMenuOpen && (
          <div
            className="absolute inset-x-0 bottom-full mb-2 rounded-[2px] border border-zinc-800/90 bg-zinc-900/95 p-1 shadow-lg shadow-black/40 transition duration-150"
            role="listbox"
            aria-label="Slash commands"
          >
            {filteredCommands.length > 0 ? (
              filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => executeSlashCommand(command.id)}
                  className={`flex w-full items-start justify-between rounded-[2px] px-3 py-2 text-left transition ${
                    index === activeCommandIndex
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-800/70"
                  }`}
                >
                  <span className="text-sm font-medium">{command.label}</span>
                  <span className="ml-4 text-xs text-zinc-500">{command.description}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-zinc-500">No matching command</p>
            )}
          </div>
        )}

        <div
          className={`w-full max-w-full border border-zinc-800/80 bg-zinc-900/90 px-3 py-2 backdrop-blur ${
            isComposerExpanded ? "rounded-[22px]" : "rounded-[26px]"
          }`}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="flex min-h-0 min-w-0 items-center overflow-hidden px-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={handleInputKeyDown}
                onFocus={() => {
                  if (authRequired) {
                    onRequireAuth();
                  }
                }}
                onClick={() => {
                  if (authRequired) {
                    onRequireAuth();
                  }
                }}
                rows={1}
                readOnly={authRequired}
                disabled={inputDisabled || isThinking}
                placeholder={
                  authRequired
                    ? "Preview mode..."
                    : inputDisabled
                      ? "Choose an API profile..."
                      : isThinking
                        ? "Thinking..."
                        : "Type your message..."
                }
                className={`max-h-42 min-h-[24px] w-full min-w-0 resize-none bg-transparent px-2 py-0 text-[15px] leading-5 outline-none placeholder:text-zinc-500 sm:text-sm ${
                  authRequired
                    ? "cursor-pointer text-zinc-500"
                    : "text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-500"
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={isThinking || inputDisabled}
              aria-label={authRequired ? "Sign in to chat" : isThinking ? "Thinking" : "Send message"}
              className={`self-end h-9 w-9 shrink-0 rounded-full border transition ${
                authRequired
                  ? "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-300"
                  : "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
              }`}
            >
              <ArrowUp className="mx-auto h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
            <button
              type="button"
              onClick={(event) => onOpenApiProfileSelector(getAnchorRect(event.currentTarget))}
              className={controlButtonClassName}
              aria-label={`API profile selector. Current selection: ${apiProfileLabel}`}
              title={apiProfileLabel}
            >
              <span className="hidden md:inline">API Profile</span>
              <span className="md:hidden">
                <ProviderBrandIcon provider={apiProfileProvider} className="h-3.5 w-3.5 shrink-0" />
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-zinc-600 md:inline" />
            </button>

            <button
              type="button"
              onClick={(event) =>
                onOpenCharacterPresetSelector(getAnchorRect(event.currentTarget))
              }
              className={controlButtonClassName}
              aria-label={`Character preset selector. Current selection: ${characterPresetLabel}`}
              title={characterPresetLabel}
            >
              <span className="hidden md:inline">Character Preset</span>
              <span className="inline md:hidden">{formatCompactCharacterLabel(characterPresetLabel)}</span>
              <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-zinc-600 md:inline" />
            </button>

            <button
              type="button"
              onClick={(event) =>
                onOpenInstructionPresetSelector(getAnchorRect(event.currentTarget))
              }
              className={controlButtonClassName}
              aria-label={`Instruction preset selector. Current selection: ${instructionPresetLabel}`}
              title={instructionPresetLabel}
            >
              <span className="hidden md:inline">Instruction Preset</span>
              <BookText className="h-3.5 w-3.5 shrink-0 md:hidden" />
              <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-zinc-600 md:inline" />
            </button>
          </div>
        </div>
        </div>
      </form>
    </section>
  );
}
