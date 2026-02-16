"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { generateAssistantReply } from "@/lib/ai-client";
import { buildChatTitle, createEmptyChatSession, createId } from "@/lib/chat-utils";
import {
  DEFAULT_CHARACTER_PRESETS,
  DEFAULT_CHAT_SESSIONS,
  DEFAULT_INSTRUCTION_PRESETS,
  DEFAULT_SETTINGS,
} from "@/lib/mock-data";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { ChatMessage, Preset, SidebarView } from "@/types/chat";
import { ApiProfile } from "@/types/settings";

import { CharacterPresetSelector } from "./character-preset-selector";
import { ChatSettingsModal } from "./chat-settings-modal";
import { ChatPanel } from "./chat-panel";
import { InstructionPresetSelector } from "./instruction-preset-selector";
import { Sidebar } from "./sidebar";

export function ChatApp() {
  const router = useRouter();
  const [settings] = useLocalStorageState(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
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

  useEffect(() => {
    setChats((prev) => {
      let changed = false;
      const normalized = prev.map((chat) => {
        if (
          chat.settingsConfigured === undefined ||
          chat.apiProfileId === undefined ||
          chat.characterPresetId === undefined ||
          chat.instructionPresetId === undefined
        ) {
          changed = true;
          return {
            ...chat,
            apiProfileId: chat.apiProfileId ?? null,
            characterPresetId: chat.characterPresetId ?? null,
            instructionPresetId: chat.instructionPresetId ?? null,
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
    if (chats.length === 0) {
      const freshChat = createEmptyChatSession(1);
      setChats([freshChat]);
      setActiveChatId(freshChat.id);
      return;
    }

    if (!activeChatId || !chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats, setActiveChatId, setChats]);

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

  const handleNewChat = () => {
    const newChat = createEmptyChatSession(chats.length + 1);
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setActiveView("chat");
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActiveView("chat");
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
        (message) =>
          !(
            message.role === "assistant" &&
            message.content.startsWith("Request failed:")
          ),
      );

      const reply = await generateAssistantReply({
        profile: selectedProfile,
        messages: messagesForModel,
        instructionContent: selectedInstructionPreset?.content,
        characterContent: selectedCharacterPreset?.content,
      });

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: reply,
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
    <main className="mx-auto flex h-screen w-full max-w-[1480px] flex-col px-3 py-4 sm:px-5 sm:py-5">
      <header className="flex items-center justify-between px-5 py-3">
        <div>
          <h1 className="text-lg font-medium tracking-tight text-zinc-100">RP Chat MVP</h1>
          <p className="text-xs text-zinc-400">
            {settings.provider} - {settings.model}
          </p>
        </div>
        <Link
          href="/settings"
          className="rounded-lg bg-zinc-800/80 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/80"
        >
          Settings
        </Link>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 gap-4 overflow-hidden">
        <Sidebar
          activeView={activeView}
          chats={sortedChats}
          activeChatId={activeChatId}
          onNewChat={handleNewChat}
          onViewChange={setActiveView}
          onSelectChat={handleSelectChat}
          onEditChatSettings={handleOpenChatSettings}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
        />

        <section className="min-h-0 flex-1">
          {activeView === "chat" && (
            <ChatPanel
              chat={activeChat}
              modelLabel={activeChatModelLabel}
              inputDisabled={activeChatInputLocked}
              setupRequired={activeChatInputLocked}
              hasApiProfiles={hasApiProfiles}
              isThinking={isActiveChatThinking}
              onSendMessage={handleSendMessage}
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
