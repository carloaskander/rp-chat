"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Cog, Menu, SlidersHorizontal } from "lucide-react";

import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { buildChatTitle, createId } from "@/lib/chat-utils";
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

export function ChatApp() {
  const router = useRouter();
  const { user, authResolved, lastAuthEvent } = useAuth();
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
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

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
    if (!authResolved) {
      return;
    }

    if (user?.id) {
      setResolvedUserId((prev) => (prev === user.id ? prev : user.id));
    }
  }, [authResolved, user?.id]);

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    if (lastAuthEvent === "SIGNED_OUT" || lastAuthEvent === "USER_DELETED") {
      setResolvedUserId(null);
      setChats([]);
      setActiveChatId(null);
    }
  }, [authResolved, lastAuthEvent, setActiveChatId, setChats]);

  useEffect(() => {
    if (!authResolved || !resolvedUserId) {
      return;
    }

    let cancelled = false;

    const loadChats = async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("id, title, story_summary, created_at, updated_at")
        .eq("user_id", resolvedUserId)
        .order("updated_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to load chats from Supabase.", error);
        return;
      }

      const now = Date.now();
      const baseChats: ChatSession[] = (data ?? []).map((row) => {
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

      if (baseChats.length === 0) {
        setChats([]);
        setActiveChatId(null);
        return;
      }

      const chatIds = baseChats.map((chat) => chat.id);
      const { data: messageRows, error: messageError } = await supabase
        .from("messages")
        .select("id, chat_id, role, content, created_at, is_archived")
        .in("chat_id", chatIds)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (cancelled) {
        return;
      }

      if (messageError) {
        console.error("Failed to load chat messages from Supabase.", messageError);
        return;
      }

      const messagesByChat = new Map<string, ChatMessage[]>();
      for (const row of messageRows ?? []) {
        const createdAt = Date.parse(row.created_at);
        const mappedMessage: ChatMessage = {
          id: row.id,
          role: row.role === "assistant" ? "assistant" : "user",
          content: row.content,
          createdAt: Number.isNaN(createdAt) ? now : createdAt,
        };
        const existing = messagesByChat.get(row.chat_id) ?? [];
        existing.push(mappedMessage);
        messagesByChat.set(row.chat_id, existing);
      }

      const nextChats = baseChats.map((chat) => ({
        ...chat,
        messages: messagesByChat.get(chat.id) ?? [],
      }));

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
  }, [authResolved, resolvedUserId, setActiveChatId, setChats]);

  useEffect(() => {
    if (!authResolved || !resolvedUserId) {
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
  }, [activeChatId, authResolved, chats, resolvedUserId, setActiveChatId]);

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

  const handleDeleteChat = async (chatId: string) => {
    if (!user) {
      console.error("Cannot delete chat: no authenticated user.");
      return;
    }

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to delete chat from Supabase.", error);
      return;
    }

    setChats((prev) => prev.filter((chat) => chat.id !== chatId));

    if (activeChatId === chatId) {
      setActiveChatId(null);
    }

    if (chatSettingsChatId === chatId) {
      setChatSettingsChatId(null);
    }
    if (thinkingChatId === chatId) {
      setThinkingChatId(null);
    }
  };

  const handleRenameChat = async (chatId: string, title: string) => {
    if (!user) {
      console.error("Cannot rename chat: no authenticated user.");
      return;
    }

    const { data, error } = await supabase
      .from("chats")
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .select("id, title, updated_at")
      .single();

    if (error || !data) {
      console.error("Failed to rename chat in Supabase.", error);
      return;
    }

    const updatedAt = Date.parse(data.updated_at);
    const fallbackUpdatedAt = Date.now();

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title: data.title || title,
              updatedAt: Number.isNaN(updatedAt) ? fallbackUpdatedAt : updatedAt,
            }
          : chat,
      ),
    );
  };

  const maybeSummarizeChat = useCallback(async (params: {
    chatId: string;
    profile: ApiProfile;
    instructionContent?: string;
    characterContent?: string;
    force?: boolean;
  }) => {
    const {
      chatId,
      profile,
      instructionContent,
      characterContent,
      force = false,
    } = params;

    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError || !authData.session?.access_token) {
      console.error("Unable to summarize chat: missing authenticated session.");
      return;
    }

    try {
      const response = await fetch("/api/chat/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          chatId,
          provider: profile.provider,
          model: profile.model,
          force,
          instructionContent,
          characterContent,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Server summarization request failed.",
        );
      }

      if (!payload?.summarized) {
        return;
      }

      const nextSummary =
        typeof payload.storySummary === "string"
          ? payload.storySummary
          : null;

      if (!nextSummary) {
        return;
      }

      const mappedMessages: ChatMessage[] = Array.isArray(payload.messages)
        ? payload.messages.map((message: {
          id: string;
          role: string;
          content: string;
          createdAt: number;
        }) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
          createdAt:
            typeof message.createdAt === "number" ? message.createdAt : Date.now(),
        }))
        : [];

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                storySummary: nextSummary,
                messages: mappedMessages,
                updatedAt:
                  typeof payload.updatedAt === "number"
                    ? payload.updatedAt
                    : Date.now(),
              }
            : chat,
        ),
      );
    } catch (error) {
      console.error("Story summarization failed", error);
    }
  }, [setChats]);

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
    if (!selectedProfile || !selectedProfile.provider.trim() || !selectedProfile.model.trim()) {
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
      chatId: targetChat.id,
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

    if (!user) {
      console.error("Cannot send message: no authenticated user.");
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
    if (!selectedProfile || !selectedProfile.provider.trim() || !selectedProfile.model.trim()) {
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
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError || !authData.session?.access_token) {
        throw new Error("Unable to resolve authenticated session.");
      }

      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          chatId: requestChatId,
          content: userMessage.content,
          provider: selectedProfile.provider,
          model: selectedProfile.model,
          instructionContent: selectedInstructionPreset?.content,
          characterContent: selectedCharacterPreset?.content,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Server chat send request failed.",
        );
      }

      const assistantMessage: ChatMessage = {
        id: payload.assistantMessage?.id ?? createId(),
        role: "assistant",
        content: payload.assistantMessage?.content ?? "",
        createdAt:
          typeof payload.assistantMessage?.createdAt === "number"
            ? payload.assistantMessage.createdAt
            : Date.now(),
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
            updatedAt:
              typeof payload.updatedAt === "number" ? payload.updatedAt : Date.now(),
          };
        }),
      );

      void maybeSummarizeChat({
        chatId: requestChatId,
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
