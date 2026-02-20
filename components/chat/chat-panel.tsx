"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, SlidersHorizontal } from "lucide-react";

import { ChatSession } from "@/types/chat";

interface ChatPanelProps {
  chat: ChatSession | null;
  modelLabel: string;
  inputDisabled: boolean;
  setupRequired: boolean;
  hasApiProfiles: boolean;
  isThinking: boolean;
  onSendMessage: (content: string) => void;
  onRunSlashCommand: (commandId: string) => void | Promise<void>;
  onOpenChatSettings: () => void;
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

export function ChatPanel({
  chat,
  modelLabel,
  inputDisabled,
  setupRequired,
  hasApiProfiles,
  isThinking,
  onSendMessage,
  onRunSlashCommand,
  onOpenChatSettings,
}: ChatPanelProps) {
  const TEXTAREA_MAX_HEIGHT = 168;
  const [inputValue, setInputValue] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [inputBarHeight, setInputBarHeight] = useState(88);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const slashQuery = inputValue.startsWith("/") ? inputValue.slice(1).trim() : "";
  const isSlashMenuOpen =
    !inputDisabled &&
    !isThinking &&
    inputValue.startsWith("/") &&
    !slashQuery.includes(" ");
  const filteredCommands = SLASH_COMMANDS.filter((command) =>
    command.name.toLowerCase().includes(slashQuery.toLowerCase()),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat?.messages.length]);

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
    if (inputDisabled) {
      onOpenChatSettings();
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

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="hidden items-start gap-3 px-8 pb-4 pt-7 md:flex">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="truncate text-base font-medium tracking-tight text-zinc-100">
              {chat?.title ?? "No Active Chat"}
            </p>
            {chat && (
              <button
                type="button"
                aria-label="Edit chat settings"
                onClick={onOpenChatSettings}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[2px] px-3 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
              >
                <SlidersHorizontal className="h-5 w-5" />
                <span>Chat settings</span>
              </button>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-zinc-500">{modelLabel}</p>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 w-full space-y-4 overflow-y-auto px-5 py-4 sm:mx-auto sm:max-w-3xl sm:px-8 sm:py-6 md:pb-6"
        style={{ paddingBottom: inputBarHeight + 16 }}
      >
        {setupRequired ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-sm text-zinc-400">
              {hasApiProfiles
                ? "Select an API profile to start chatting."
                : "Create an API profile first to start chatting."}
            </p>
            <button
              type="button"
              onClick={onOpenChatSettings}
              className="mt-4 rounded-[2px] border border-zinc-700 bg-zinc-800 px-4 py-2 text-[15px] font-medium text-zinc-200 hover:bg-zinc-700 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              {hasApiProfiles ? "Open Chat Settings" : "Go to Settings"}
            </button>
          </div>
        ) : chat?.messages.length ? (
          chat.messages.map((message) =>
            (() => {
              const isTransportError =
                message.role === "assistant" &&
                message.content.startsWith("Request failed:");
              const isSummarySystemNotice =
                message.role === "assistant" &&
                isSummaryNotice(message.content);

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "w-full justify-start"
                  }`}
                >
                  {isSummarySystemNotice ? (
                    <div className="mx-auto w-full max-w-3xl">
                      <p className="rounded-[2px] border border-zinc-800/80 bg-zinc-900/55 px-3 py-2 text-center text-xs font-medium tracking-wide text-zinc-400">
                        {formatSummaryNotice(message.content)}
                      </p>
                    </div>
                  ) : message.role === "user" ? (
                    <div className="max-w-[88%] rounded-2xl bg-zinc-800 px-4 py-3 text-[15px] leading-relaxed text-zinc-100 sm:max-w-[78%] sm:text-sm">
                      {message.content}
                    </div>
                  ) : isTransportError ? (
                    <article className="w-full max-w-3xl rounded-xl border border-rose-500/50 bg-rose-950/30 px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-rose-200">
                      {message.content}
                    </article>
                  ) : (
                    <article className="w-full max-w-3xl px-1 text-[15px] leading-7 whitespace-pre-wrap text-zinc-200">
                      {message.content}
                    </article>
                  )}
                </div>
              );
            })(),
          )
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
          className={`grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] gap-2 border border-zinc-800/80 bg-zinc-900/90 px-3 py-2 backdrop-blur ${
            isComposerExpanded ? "rounded-[22px]" : "rounded-full"
          }`}
        >
          <div className="flex min-h-0 min-w-0 items-center overflow-hidden px-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={handleInputKeyDown}
              rows={1}
              disabled={inputDisabled || isThinking}
              placeholder={
                inputDisabled
                  ? "Select chat settings..."
                  : isThinking
                    ? "Thinking..."
                    : "Type your message..."
              }
              className="max-h-42 min-h-[24px] w-full min-w-0 resize-none bg-transparent px-2 py-0 text-[15px] leading-5 text-zinc-100 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={inputDisabled || isThinking}
            aria-label={isThinking ? "Thinking" : "Send message"}
            className="self-end h-9 w-9 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-60"
          >
            <ArrowUp className="mx-auto h-4 w-4" />
          </button>
        </div>
        </div>
      </form>
    </section>
  );
}
