"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { ChatSession } from "@/types/chat";

interface ChatPanelProps {
  chat: ChatSession | null;
  modelLabel: string;
  inputDisabled: boolean;
  setupRequired: boolean;
  hasApiProfiles: boolean;
  onSendMessage: (content: string) => void;
  onOpenChatSettings: () => void;
}

export function ChatPanel({
  chat,
  modelLabel,
  inputDisabled,
  setupRequired,
  hasApiProfiles,
  onSendMessage,
  onOpenChatSettings,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat?.messages.length]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = inputValue.trim();
    if (inputDisabled) {
      onOpenChatSettings();
      return;
    }

    if (!trimmed) {
      return;
    }

    onSendMessage(trimmed);
    setInputValue("");
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <header className="group flex items-start justify-between gap-3 px-8 pb-4 pt-7">
        <div>
          <p className="text-base font-medium tracking-tight text-zinc-100">
            {chat?.title ?? "No Active Chat"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{modelLabel}</p>
        </div>
        {chat && (
          <button
            type="button"
            onClick={onOpenChatSettings}
            className="text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            Edit chat settings
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-8 py-6">
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
              className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
            >
              {hasApiProfiles ? "Open Chat Settings" : "Go to Settings"}
            </button>
          </div>
        ) : chat?.messages.length ? (
          chat.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "w-full justify-start"
              }`}
            >
              {message.role === "user" ? (
                <div className="max-w-[78%] rounded-2xl bg-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-100">
                  {message.content}
                </div>
              ) : (
                <article className="w-full max-w-3xl px-1 text-[15px] leading-7 text-zinc-200 whitespace-pre-wrap">
                  {message.content}
                </article>
              )}
            </div>
          ))
        ) : (
          <div className="mx-auto mt-16 max-w-md text-center text-sm text-zinc-500">
            Send a message to begin this chat.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2">
        <div className="flex items-end gap-3 rounded-2xl bg-zinc-900/70 p-2">
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            rows={2}
            disabled={inputDisabled}
            placeholder={
              inputDisabled
                ? "Select an API profile in Chat Settings..."
                : "Type your message..."
            }
            className="min-h-20 flex-1 resize-none rounded-xl bg-transparent px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
          />
          <button
            type="submit"
            disabled={inputDisabled}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
