"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Cog, Menu, SlidersHorizontal } from "lucide-react";

import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { generateAssistantReply, generateStorySummary } from "@/lib/ai-client";
import { buildChatTitle, createEmptyChatSession, createId } from "@/lib/chat-utils";
import {
  DEFAULT_CHARACTER_PRESETS,
  DEFAULT_CHAT_SESSIONS,
  DEFAULT_INSTRUCTION_PRESETS,
} from "@/lib/mock-data";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { supabase } from "@/lib/supabase";
import { ChatMessage, ChatSession, Preset, SidebarView } from "@/types/chat";
import { ApiProfile } from "@/types/settings";
import { useAuth } from "@/components/auth/auth-provider";

import { CharacterPresetSelector } from "./character-preset-selector";
import { ChatSettingsModal } from "./chat-settings-modal";
import { ChatPanel } from "./chat-panel";
import { InstructionPresetSelector } from "./instruction-preset-selector";
import { Sidebar } from "./sidebar";

const ESTIMATED_CONTEXT_LIMIT_TOKENS = 8000;
const SUMMARY_TRIGGER_USAGE_RATIO = 0.68;
const SUMMARY_TRIGGER_TOKEN_ESTIMATE = Math.floor(
  ESTIMATED_CONTEXT_LIMIT_TOKENS * SUMMARY_TRIGGER_USAGE_RATIO,
);
const SUMMARY_RESPONSE_BUFFER_TOKENS =
  ESTIMATED_CONTEXT_LIMIT_TOKENS - SUMMARY_TRIGGER_TOKEN_ESTIMATE;
const SUMMARY_KEEP_RECENT_TOKEN_ESTIMATE = 1400;
const SUMMARY_MIN_CONDENSE_TOKEN_ESTIMATE = 900;
const TOKEN_ESTIMATE_CHARS_PER_TOKEN = 4;
const TOKEN_ESTIMATE_MESSAGE_OVERHEAD = 8;
const SUMMARY_NOTICE_PREFIX = "[summary-notice]";
const SUMMARY_NOTICE_TEXT =
  "Earlier parts of this conversation were summarized to keep context efficient.";

function isTransportFailure(message: ChatMessage): boolean {
  return (
    message.role === "assistant" &&
    message.content.startsWith("Request failed:")
  );
}

function isSummaryNotice(message: ChatMessage): boolean {
  return (
    message.role === "assistant" &&
    message.content.startsWith(SUMMARY_NOTICE_PREFIX)
  );
}

function createSummaryNoticeMessage(): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    content: SUMMARY_NOTICE_PREFIX + " " + SUMMARY_NOTICE_TEXT,
    createdAt: Date.now(),
  };
}

function estimateMessageTokens(message: ChatMessage): number {
  return Math.ceil(message.content.length / TOKEN_ESTIMATE_CHARS_PER_TOKEN)
    + TOKEN_ESTIMATE_MESSAGE_OVERHEAD;
}

function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0,
  );
}

function isModelContextMessage(message: ChatMessage): boolean {
  return !isTransportFailure(message) && !isSummaryNotice(message);
}

function findRecentMessageStartIndex(
  messages: ChatMessage[],
  keepRecentTokenBudget: number,
): number {
  let recentTokenEstimate = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (isModelContextMessage(message)) {
      recentTokenEstimate += estimateMessageTokens(message);
    }

    if (recentTokenEstimate >= keepRecentTokenBudget) {
      return index;
    }
  }

  return 0;
}

function findMandatoryPreserveStartIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "user" && isModelContextMessage(message)) {
      return index;
    }
  }

  return Math.max(messages.length - 1, 0);
}

function findCondenseFromIndex(
  messages: ChatMessage[],
  keepRecentTokenBudget: number,
): number {
  const budgetStartIndex = findRecentMessageStartIndex(
    messages,
    keepRecentTokenBudget,
  );
  const mandatoryPreserveStartIndex = findMandatoryPreserveStartIndex(messages);

  return Math.min(budgetStartIndex, mandatoryPreserveStartIndex);
}

export function ChatApp() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [chats, setChats] = useLocalStorageState(STORAGE_KEYS.chats, DEFAULT_CHAT_SESSIONS);
  const [activeChatId, setActiveChatId] = useLocalStorageState<string | null>(
    STORAGE_KEYS.activeChatId,
    DEFAULT_CHAT_SESSIONS[0]?.id ?? null,
  );
  const [instructionPresets, setInstructionPresets] = useLocalStorageState(
    STORAGE_KEYS.instructionPresets,
    DEFAULT_INSTRUCTION_PRESETS,
  );
  const [characterPresets, setCharacterPresets] = useLocalStorageState(
    STORAGE_KEYS.characterPresets,
    DEFAULT_CHARACTER_PRESETS,
  );
  const [apiProfiles] = useLocalStorageState<ApiProfile[]>(STORAGE_KEYS.apiProfiles, []);

  const [activeView, setActiveView] = useState<SidebarView>("chat");
  const [chatSettingsChatId, setChatSettingsChatId] = useState<string | null>(null);
  const [thinkingChatId, setThinkingChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setChats((prev) => {
      let changed = false;
      const normalized = prev.map((chat) => {
        if (
          chat.settingsConfigured === undefined ||
          chat.apiProfileId === undefined ||
          chat.characterPresetId === undefined ||
          chat.instructionPresetId === undefined ||
          chat.storySummary === undefined
        ) {
          changed = true;
          return {
            ...chat,
            apiProfileId: chat.apiProfileId ?? null,
            characterPresetId: chat.characterPresetId ?? null,
            instructionPresetId: chat.instructionPresetId ?? null,
            storySummary: chat.storySummary ?? null,
            settingsConfigured:
              chat.settingsConfigured ?? Boolean(chat.apiProfileId ?? null),
          };
        }
        return chat;
      });

      return changed ? normalized : prev;
    });
  }, [setChats]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      setChats([]);
      setActiveChatId(null);
      return;
    }

    let cancelled = false;

    const loadChats = async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("id, title, story_summary, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to load chats from Supabase.", error);
        return;
      }

      const now = Date.now();
      const nextChats: ChatSession[] = (data ?? []).map((row) => {
        const createdAt = Date.parse(row.created_at);
        const updatedAt = Date.parse(row.updated_at);

        return {
          id: row.id,
          title: row.title || "New Chat",
          storySummary: row.story_summary,
          messages: [],
          apiProfileId: null,
          characterPresetId: null,
          instructionPresetId: null,
          settingsConfigured: false,
          createdAt: Number.isNaN(createdAt) ? now : createdAt,
          updatedAt: Number.isNaN(updatedAt) ? now : updatedAt,
        };
      });

      setChats(nextChats);
      setActiveChatId((prev) => {
        if (nextChats.length === 0) {
          return null;
        }

        if (prev && nextChats.some((chat) => chat.id === prev)) {
          return prev;
        }

        return nextChats[0].id;
      });
    };

    void loadChats();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, user, setActiveChatId, setChats]);

  useEffect(() => {
    if (isAuthLoading || !user) {
      return;
    }

    if (chats.length === 0) {
      if (activeChatId !== null) {
        setActiveChatId(null);
      }
      return;
    }

    if (!activeChatId || !chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats, isAuthLoading, setActiveChatId, user]);

  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => b.updatedAt - a.updatedAt),
    [chats],
  );

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const activeChatApiProfile = apiProfiles.find(
    (profile) => profile.id === activeChat?.apiProfileId,
  );
  const editingChat = chats.find((chat) => chat.id === chatSettingsChatId) ?? null;
  const activeChatInputLocked = Boolean(activeChat && !activeChat.apiProfileId);
  const hasApiProfiles = apiProfiles.length > 0;
  const activeInstructionPreset = instructionPresets.find(
    (preset) => preset.id === activeChat?.instructionPresetId,
  );
  const activeCharacterPreset = characterPresets.find(
    (preset) => preset.id === activeChat?.characterPresetId,
  );
  const activeChatModelLabel = [
    activeChatApiProfile
      ? `${activeChatApiProfile.name} (${activeChatApiProfile.model || "Model not set"})`
      : "No API profile selected",
    activeInstructionPreset?.name ?? "No instruction preset",
    activeCharacterPreset?.name ?? "No character preset",
  ].join(" · ");
  const isActiveChatThinking = Boolean(activeChat && thinkingChatId === activeChat.id);

  const handleNewChat = async () => {
    if (!user) {
      console.error("Cannot create chat: no authenticated user.");
      return;
    }

    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: user.id,
        title: "New Chat",
        story_summary: null,
      })
      .select("id, title, story_summary, created_at, updated_at")
      .single();

    if (error || !data) {
      console.error("Failed to create chat in Supabase.", error);
      return;
    }

    const createdAt = Date.parse(data.created_at);
    const updatedAt = Date.parse(data.updated_at);
    const now = Date.now();
    const newChat: ChatSession = {
      id: data.id,
      title: data.title || "New Chat",
      storySummary: data.story_summary,
      messages: [],
      apiProfileId: null,
      characterPresetId: null,
      instructionPresetId: null,
      settingsConfigured: false,
      createdAt: Number.isNaN(createdAt) ? now : createdAt,
      updatedAt: Number.isNaN(updatedAt) ? now : updatedAt,
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setActiveView("chat");
    setIsSidebarOpen(false);
  };

  const handleViewChange = (view: SidebarView) => {
    setActiveView(view);
    setIsSidebarOpen(false);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActiveView("chat");
    setIsSidebarOpen(false);
  };

  const handleDeleteChat = (chatId: string) => {
    setChats((prev) => {
      const nextChats = prev.filter((chat) => chat.id !== chatId);

      if (nextChats.length === 0) {
        const freshChat = createEmptyChatSession(1);
        setActiveChatId(freshChat.id);
        return [freshChat];
      }

      if (activeChatId === chatId) {
        setActiveChatId(nextChats[0].id);
      }

      if (chatSettingsChatId === chatId) {
        setChatSettingsChatId(null);
      }
      if (thinkingChatId === chatId) {
        setThinkingChatId(null);
      }

      return nextChats;
    });
  };

  const handleRenameChat = (chatId: string, title: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title,
              updatedAt: Date.now(),
            }
          : chat,
      ),
    );
  };

  const maybeSummarizeChat = async (params: {
    chatSnapshot: ChatSession;
    profile: ApiProfile;
    instructionContent?: string;
    characterContent?: string;
    force?: boolean;
  }) => {
    const {
      chatSnapshot,
      profile,
      instructionContent,
      characterContent,
      force = false,
    } = params;

    const lastContextMessage = [...chatSnapshot.messages]
      .reverse()
      .find((message) => isModelContextMessage(message));

    // Never summarize mid-turn; only summarize after an assistant response exists.
    if (!lastContextMessage || lastContextMessage.role !== "assistant") {
      return;
    }

    const summarizableMessages = chatSnapshot.messages.filter((message) =>
      isModelContextMessage(message),
    );
    const totalTokenEstimate = estimateMessagesTokens(summarizableMessages);

    if (!force && totalTokenEstimate < SUMMARY_TRIGGER_TOKEN_ESTIMATE) {
      return;
    }

    const condenseFromIndex = findCondenseFromIndex(
      chatSnapshot.messages,
      Math.min(
        SUMMARY_KEEP_RECENT_TOKEN_ESTIMATE,
        ESTIMATED_CONTEXT_LIMIT_TOKENS - SUMMARY_RESPONSE_BUFFER_TOKENS,
      ),
    );

    if (condenseFromIndex <= 0) {
      return;
    }

    const messagesToCondense = chatSnapshot.messages
      .slice(0, condenseFromIndex)
      .filter((message) => isModelContextMessage(message));

    if (
      !force &&
      estimateMessagesTokens(messagesToCondense) < SUMMARY_MIN_CONDENSE_TOKEN_ESTIMATE
    ) {
      return;
    }

    try {
      const updatedSummary = await generateStorySummary({
        profile,
        existingSummary: chatSnapshot.storySummary,
        messagesToCondense,
        instructionContent,
        characterContent,
      });
      const nextSummary = updatedSummary.trim();

      if (!nextSummary) {
        return;
      }

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatSnapshot.id) {
            return chat;
          }

          const latestLastContextMessage = [...chat.messages]
            .reverse()
            .find((message) => isModelContextMessage(message));

          if (!latestLastContextMessage || latestLastContextMessage.role !== "assistant") {
            return chat;
          }

          const latestSummarizableMessages = chat.messages.filter((message) =>
            isModelContextMessage(message),
          );
          const latestTokenEstimate = estimateMessagesTokens(latestSummarizableMessages);

          if (!force && latestTokenEstimate < SUMMARY_TRIGGER_TOKEN_ESTIMATE) {
            return chat;
          }

          const latestCondenseFromIndex = findCondenseFromIndex(
            chat.messages,
            Math.min(
              SUMMARY_KEEP_RECENT_TOKEN_ESTIMATE,
              ESTIMATED_CONTEXT_LIMIT_TOKENS - SUMMARY_RESPONSE_BUFFER_TOKENS,
            ),
          );

          if (latestCondenseFromIndex <= 0) {
            return chat;
          }

          const latestMessagesToCondense = chat.messages
            .slice(0, latestCondenseFromIndex)
            .filter((message) => isModelContextMessage(message));

          if (
            !force &&
            estimateMessagesTokens(latestMessagesToCondense)
            < SUMMARY_MIN_CONDENSE_TOKEN_ESTIMATE
          ) {
            return chat;
          }

          const nextRecentMessages = chat.messages
            .slice(latestCondenseFromIndex)
            .filter((message) => !isSummaryNotice(message));
          const nextMessages = [...nextRecentMessages, createSummaryNoticeMessage()];

          return {
            ...chat,
            storySummary: nextSummary,
            messages: nextMessages,
            updatedAt: Date.now(),
          };
        }),
      );
    } catch (error) {
      console.error("Story summarization failed", error);
    }
  };

  const handleSlashCommand = async (commandId: string) => {
    if (commandId !== "summarize" || !activeChatId) {
      return;
    }

    const targetChat = chats.find((chat) => chat.id === activeChatId);
    if (!targetChat || !targetChat.apiProfileId) {
      if (!hasApiProfiles) {
        router.push("/settings");
        return;
      }
      setChatSettingsChatId(activeChatId);
      return;
    }

    const selectedProfile = apiProfiles.find((profile) => profile.id === targetChat.apiProfileId);
    if (!selectedProfile || !selectedProfile.apiKey.trim()) {
      setChatSettingsChatId(activeChatId);
      return;
    }

    const selectedInstructionPreset = instructionPresets.find(
      (preset) => preset.id === targetChat.instructionPresetId,
    );
    const selectedCharacterPreset = characterPresets.find(
      (preset) => preset.id === targetChat.characterPresetId,
    );

    await maybeSummarizeChat({
      chatSnapshot: targetChat,
      profile: selectedProfile,
      instructionContent: selectedInstructionPreset?.content,
      characterContent: selectedCharacterPreset?.content,
      force: true,
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!activeChatId) {
      return;
    }

    const targetChat = chats.find((chat) => chat.id === activeChatId);
    if (!targetChat || !targetChat.apiProfileId) {
      if (!hasApiProfiles) {
        router.push("/settings");
        return;
      }
      setChatSettingsChatId(activeChatId);
      return;
    }

    const selectedProfile = apiProfiles.find((profile) => profile.id === targetChat.apiProfileId);
    if (!selectedProfile || !selectedProfile.apiKey.trim()) {
      setChatSettingsChatId(activeChatId);
      return;
    }

    const selectedInstructionPreset = instructionPresets.find(
      (preset) => preset.id === targetChat.instructionPresetId,
    );
    const selectedCharacterPreset = characterPresets.find(
      (preset) => preset.id === targetChat.characterPresetId,
    );
    const requestChatId = activeChatId;

    const now = Date.now();

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content,
      createdAt: now,
    };

    setChats((prev) =>
      prev.map((chat, index) => {
        if (chat.id !== activeChatId) {
          return chat;
        }

        const nextMessages = [...chat.messages, userMessage];

        return {
          ...chat,
          messages: nextMessages,
          title: buildChatTitle(nextMessages, index + 1),
          updatedAt: now,
        };
      }),
    );
    setThinkingChatId(requestChatId);

    try {
      const messagesForModel = [...targetChat.messages, userMessage].filter(
        (message) => isModelContextMessage(message),
      );

      const reply = await generateAssistantReply({
        profile: selectedProfile,
        messages: messagesForModel,
        instructionContent: selectedInstructionPreset?.content,
        characterContent: selectedCharacterPreset?.content,
        storySummary: targetChat.storySummary,
      });

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: reply,
        createdAt: Date.now(),
      };

      const chatAfterAssistant: ChatSession = {
        ...targetChat,
        messages: [...targetChat.messages, userMessage, assistantMessage],
        title: buildChatTitle(
          [...targetChat.messages, userMessage, assistantMessage],
          1,
        ),
        updatedAt: Date.now(),
      };

      setChats((prev) =>
        prev.map((chat, index) => {
          if (chat.id !== requestChatId) {
            return chat;
          }

          const nextMessages = [...chat.messages, assistantMessage];

          return {
            ...chat,
            messages: nextMessages,
            title: buildChatTitle(nextMessages, index + 1),
            updatedAt: Date.now(),
          };
        }),
      );

      void maybeSummarizeChat({
        chatSnapshot: chatAfterAssistant,
        profile: selectedProfile,
        instructionContent: selectedInstructionPreset?.content,
        characterContent: selectedCharacterPreset?.content,
      });
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content:
          error instanceof Error
            ? `Request failed: ${error.message}`
            : "Request failed: unknown error",
        createdAt: Date.now(),
      };

      setChats((prev) =>
        prev.map((chat, index) => {
          if (chat.id !== requestChatId) {
            return chat;
          }

          const nextMessages = [...chat.messages, assistantMessage];

          return {
            ...chat,
            messages: nextMessages,
            title: buildChatTitle(nextMessages, index + 1),
            updatedAt: Date.now(),
          };
        }),
      );
    } finally {
      setThinkingChatId((prev) => (prev === requestChatId ? null : prev));
    }
  };

  const createPresetHandlers = (
    kind: "instruction" | "character",
  ): {
    presets: Preset[];
    createPreset: (name: string, content: string) => void;
    updatePreset: (presetId: string, updates: Partial<Preset>) => void;
    deletePreset: (presetId: string) => void;
  } => {
    const presets = kind === "instruction" ? instructionPresets : characterPresets;
    const setPresets =
      kind === "instruction" ? setInstructionPresets : setCharacterPresets;

    const createPreset = (name: string, content: string) => {
      setPresets((prev) => [
        {
          id: createId(),
          name,
          content,
        },
        ...prev,
      ]);
    };

    const updatePreset = (presetId: string, updates: Partial<Preset>) => {
      setPresets((prev) =>
        prev.map((preset) =>
          preset.id === presetId ? { ...preset, ...updates } : preset,
        ),
      );
    };

    const deletePreset = (presetId: string) => {
      setPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    };

    return {
      presets,
      createPreset,
      updatePreset,
      deletePreset,
    };
  };

  const instructionPresetHandlers = createPresetHandlers("instruction");
  const characterPresetHandlers = createPresetHandlers("character");

  const handleOpenChatSettings = (chatId: string) => {
    if (!hasApiProfiles) {
      router.push("/settings");
      return;
    }
    setChatSettingsChatId(chatId);
  };

  const handleSaveChatSettings = (values: {
    apiProfileId: string | null;
    characterPresetId: string | null;
    instructionPresetId: string | null;
  }) => {
    if (!chatSettingsChatId) {
      return;
    }

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatSettingsChatId
          ? {
              ...chat,
              ...values,
              settingsConfigured: Boolean(values.apiProfileId),
              updatedAt: Date.now(),
            }
          : chat,
      ),
    );
    setChatSettingsChatId(null);
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-[1480px] flex-col px-2 py-2 sm:px-5 sm:py-5">
      <header className="flex items-center justify-between px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="p-1.5 text-zinc-300 transition hover:text-zinc-100 md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0 md:hidden">
              <h1 className="truncate text-[1.05rem] font-medium tracking-tight text-zinc-100">
                {activeView === "chat" ? activeChat?.title ?? "No Active Chat" : "RP Chat MVP"}
              </h1>
              <p className="truncate text-xs text-zinc-500">
                {activeView === "chat" ? activeChatModelLabel : "Your private roleplay hub"}
              </p>
            </div>
            <h1 className="hidden text-[1.1rem] font-medium tracking-tight text-zinc-100 md:block sm:text-lg">
              RP Chat MVP
            </h1>
          </div>
          <p className="hidden truncate text-sm text-zinc-400 md:block sm:text-xs">
            Your private roleplay hub
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeView === "chat" && activeChat && (
            <button
              type="button"
              aria-label="Edit chat settings"
              onClick={() => handleOpenChatSettings(activeChat.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 md:hidden"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          )}
          <Link
            href="/settings"
            aria-label="Open settings"
            className="hidden h-9 items-center gap-2 rounded-[2px] px-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 md:inline-flex"
          >
            <Cog className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </div>
      </header>

      <div className="mt-2 flex min-h-0 min-w-0 flex-1 overflow-hidden sm:mt-4 sm:gap-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsSidebarOpen(false);
            }
          }}
          className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${
            isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        <Sidebar
          activeView={activeView}
          chats={sortedChats}
          activeChatId={activeChatId}
          onNewChat={handleNewChat}
          onViewChange={handleViewChange}
          onSelectChat={handleSelectChat}
          onEditChatSettings={handleOpenChatSettings}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          className={`fixed inset-y-0 left-0 z-40 flex w-[85vw] max-w-72 flex-col bg-zinc-950 px-2 py-2 shadow-2xl transition-transform md:static md:z-auto md:w-full md:max-w-72 md:translate-x-0 md:bg-transparent md:shadow-none ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        />

        <section className="min-h-0 min-w-0 flex-1">
          {activeView === "chat" && (
            <ChatPanel
              chat={activeChat}
              modelLabel={activeChatModelLabel}
              inputDisabled={activeChatInputLocked}
              setupRequired={activeChatInputLocked}
              hasApiProfiles={hasApiProfiles}
              isThinking={isActiveChatThinking}
              onSendMessage={handleSendMessage}
              onRunSlashCommand={handleSlashCommand}
              onOpenChatSettings={() => {
                if (activeChat) {
                  handleOpenChatSettings(activeChat.id);
                }
              }}
            />
          )}

          {activeView === "instructionPresets" && (
            <InstructionPresetSelector
              presets={instructionPresetHandlers.presets}
              onCreatePreset={instructionPresetHandlers.createPreset}
              onUpdatePreset={instructionPresetHandlers.updatePreset}
              onDeletePreset={instructionPresetHandlers.deletePreset}
            />
          )}

          {activeView === "characterPresets" && (
            <CharacterPresetSelector
              presets={characterPresetHandlers.presets}
              onCreatePreset={characterPresetHandlers.createPreset}
              onUpdatePreset={characterPresetHandlers.updatePreset}
              onDeletePreset={characterPresetHandlers.deletePreset}
            />
          )}

        </section>
      </div>

      <ChatSettingsModal
        key={editingChat?.id ?? "chat-settings"}
        open={editingChat !== null}
        title={editingChat?.apiProfileId ? "Edit Chat Settings" : "Set Up Chat"}
        initialValues={{
          apiProfileId: editingChat?.apiProfileId ?? null,
          characterPresetId: editingChat?.characterPresetId ?? null,
          instructionPresetId: editingChat?.instructionPresetId ?? null,
        }}
        apiProfiles={apiProfiles}
        characterPresets={characterPresets}
        instructionPresets={instructionPresets}
        onSave={handleSaveChatSettings}
        onCancel={() => setChatSettingsChatId(null)}
      />
    </main>
  );
}
