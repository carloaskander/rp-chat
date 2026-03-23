"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";

import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { buildChatTitle, createId } from "@/lib/chat-utils";
import {
  DEFAULT_CHARACTER_PRESETS,
  DEFAULT_INSTRUCTION_PRESETS,
} from "@/lib/mock-data";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { supabase } from "@/lib/supabase";
import { ChatMessage, ChatSession, MessageVersion, Preset, SidebarView } from "@/types/chat";
import { ApiProfile } from "@/types/settings";
import { useAuth } from "@/components/auth/auth-provider";

import { CharacterPresetSelector } from "./character-preset-selector";
import { ChatOptionSelectorModal, SelectorAnchorRect } from "./chat-option-selector-modal";
import { ChatPanel } from "./chat-panel";
import { InstructionPresetSelector } from "./instruction-preset-selector";
import { Sidebar } from "./sidebar";

const MESSAGE_PAGE_SIZE = 50;

interface ChatMessagePaginationState {
  oldestSequenceNumber: number | null;
  hasOlder: boolean;
  isLoading: boolean;
}

interface ChatAppCacheState {
  userId: string | null;
  chats: ChatSession[];
  activeChatId: string | null;
  apiProfiles: ApiProfile[];
  chatMessagePagination: Record<string, ChatMessagePaginationState>;
  loadedMessageChatIds: Record<string, true>;
  hasLoadedProfiles: boolean;
  hasLoadedChats: boolean;
}

type ChatOptionSelectorKind = "apiProfile" | "characterPreset" | "instructionPreset";

interface ChatOptionSelectorState {
  chatId: string;
  kind: ChatOptionSelectorKind;
  anchorRect: SelectorAnchorRect | null;
}

interface ChatMessageRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
  version_group_id: string;
  sequence_number: number;
}

interface MessageVersionRow {
  id: string;
  created_at: string;
  version_group_id: string;
}

const chatAppCache: ChatAppCacheState = {
  userId: null,
  chats: [],
  activeChatId: null,
  apiProfiles: [],
  chatMessagePagination: {},
  loadedMessageChatIds: {},
  hasLoadedProfiles: false,
  hasLoadedChats: false,
};

function buildVersionsByGroup(rows: MessageVersionRow[]): Map<string, MessageVersion[]> {
  const versionsByGroup = new Map<string, MessageVersion[]>();

  for (const row of rows) {
    const currentVersions = versionsByGroup.get(row.version_group_id) ?? [];
    const parsedCreatedAt = Date.parse(row.created_at);
    currentVersions.push({
      id: row.id,
      createdAt: Number.isNaN(parsedCreatedAt) ? Date.now() : parsedCreatedAt,
    });
    versionsByGroup.set(row.version_group_id, currentVersions);
  }

  return versionsByGroup;
}

function mapRowsToChatMessages(
  rows: ChatMessageRow[],
  versionsByGroup: Map<string, MessageVersion[]>,
): ChatMessage[] {
  return rows.map((row) => {
    const parsedCreatedAt = Date.parse(row.created_at);
    const createdAt = Number.isNaN(parsedCreatedAt) ? Date.now() : parsedCreatedAt;
    const versions = versionsByGroup.get(row.version_group_id) ?? [
      {
        id: row.id,
        createdAt,
      },
    ];
    const activeVersionIndex = Math.max(
      versions.findIndex((version) => version.id === row.id),
      0,
    );

    return {
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
      createdAt,
      versionGroupId: row.version_group_id,
      sequenceNumber: row.sequence_number,
      versions,
      activeVersionIndex,
    };
  });
}

function createSingleVersionMessage(message: {
  id: string;
  role: ChatMessage["role"];
  content: string;
  createdAt: number;
  sequenceNumber: number;
  versionGroupId?: string;
}): ChatMessage {
  const versionGroupId = message.versionGroupId ?? message.id;

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    versionGroupId,
    sequenceNumber: message.sequenceNumber,
    versions: [
      {
        id: message.id,
        createdAt: message.createdAt,
      },
    ],
    activeVersionIndex: 0,
  };
}

export function ChatApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session, authResolved, isPreviewMode, lastAuthEvent, requireAuth } = useAuth();
  const [chats, setChats] = useState<ChatSession[]>(() => chatAppCache.chats);
  const [activeChatId, setActiveChatId] = useState<string | null>(() => chatAppCache.activeChatId);
  const [instructionPresets, setInstructionPresets] = useLocalStorageState(
    STORAGE_KEYS.instructionPresets,
    DEFAULT_INSTRUCTION_PRESETS,
  );
  const [characterPresets, setCharacterPresets] = useLocalStorageState(
    STORAGE_KEYS.characterPresets,
    DEFAULT_CHARACTER_PRESETS,
  );
  const [apiProfiles, setApiProfiles] = useState<ApiProfile[]>(() => chatAppCache.apiProfiles);
  const [hasLoadedApiProfiles, setHasLoadedApiProfiles] = useState(() => chatAppCache.hasLoadedProfiles);

  const [activeView, setActiveView] = useState<SidebarView>("chat");
  const [chatOptionSelector, setChatOptionSelector] = useState<ChatOptionSelectorState | null>(null);
  const [thinkingChatId, setThinkingChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const requestedView = searchParams.get("view");

    if (requestedView === "instructionPresets" || requestedView === "characterPresets" || requestedView === "chat") {
      setActiveView(requestedView);
    }
  }, [searchParams]);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [chatMessagePagination, setChatMessagePagination] = useState<
    Record<string, ChatMessagePaginationState>
  >(() => chatAppCache.chatMessagePagination);
  const [loadedMessageChatIds, setLoadedMessageChatIds] = useState<Record<string, true>>(
    () => chatAppCache.loadedMessageChatIds,
  );

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

    if (lastAuthEvent === "SIGNED_OUT") {
      chatAppCache.userId = null;
      chatAppCache.chats = [];
      chatAppCache.activeChatId = null;
      chatAppCache.apiProfiles = [];
      chatAppCache.chatMessagePagination = {};
      chatAppCache.loadedMessageChatIds = {};
      chatAppCache.hasLoadedProfiles = false;
      chatAppCache.hasLoadedChats = false;
      setResolvedUserId(null);
      setChats([]);
      setActiveChatId(null);
      setApiProfiles([]);
      setHasLoadedApiProfiles(false);
      setChatMessagePagination({});
      setLoadedMessageChatIds({});
      setChatOptionSelector(null);
    }
  }, [authResolved, lastAuthEvent, setApiProfiles]);

  useEffect(() => {
    chatAppCache.userId = resolvedUserId;
    chatAppCache.chats = chats;
    chatAppCache.activeChatId = activeChatId;
    chatAppCache.apiProfiles = apiProfiles;
    chatAppCache.chatMessagePagination = chatMessagePagination;
    chatAppCache.loadedMessageChatIds = loadedMessageChatIds;
  }, [activeChatId, apiProfiles, chatMessagePagination, chats, loadedMessageChatIds, resolvedUserId]);

  useEffect(() => {
    if (!authResolved || !resolvedUserId || !session?.access_token) {
      setApiProfiles([]);
      setHasLoadedApiProfiles(false);
      return;
    }

    if (chatAppCache.userId === resolvedUserId && chatAppCache.hasLoadedProfiles) {
      setApiProfiles(chatAppCache.apiProfiles);
      setHasLoadedApiProfiles(true);
      return;
    }

    let cancelled = false;

    const loadApiProfiles = async () => {
      const { data, error } = await supabase
        .from("api_profiles")
        .select("id, name, provider, model, updated_at")
        .eq("user_id", resolvedUserId)
        .order("updated_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Failed to load API profiles from Supabase.", error);
        setHasLoadedApiProfiles(true);
        return;
      }

      const nextProfiles: ApiProfile[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        provider: row.provider,
        model: row.model,
        apiKey: "",
      }));

      setApiProfiles(nextProfiles);
      setHasLoadedApiProfiles(true);
      chatAppCache.hasLoadedProfiles = true;
    };

    void loadApiProfiles();

    return () => {
      cancelled = true;
    };
  }, [authResolved, resolvedUserId, session?.access_token]);

  useEffect(() => {
    if (!authResolved || !resolvedUserId || !session?.access_token) {
      return;
    }

    if (chatAppCache.userId === resolvedUserId && chatAppCache.hasLoadedChats) {
      setChats(chatAppCache.chats);
      setChatMessagePagination(chatAppCache.chatMessagePagination);
      setLoadedMessageChatIds(chatAppCache.loadedMessageChatIds);
      setActiveChatId((prev) => prev ?? chatAppCache.activeChatId ?? chatAppCache.chats[0]?.id ?? null);
      return;
    }

    let cancelled = false;

    const loadChats = async () => {
      const { data, error } = await supabase
        .from("chats")
        .select(
          "id, title, story_summary, api_profile_id, character_preset_id, instruction_preset_id, created_at, updated_at",
        )
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
          apiProfileId: row.api_profile_id,
          characterPresetId: row.character_preset_id,
          instructionPresetId: row.instruction_preset_id,
          settingsConfigured: Boolean(row.api_profile_id),
          createdAt: Number.isNaN(createdAt) ? now : createdAt,
          updatedAt: Number.isNaN(updatedAt) ? now : updatedAt,
        };
      });

      if (baseChats.length === 0) {
        setChats([]);
        setActiveChatId(null);
        setChatMessagePagination({});
        setLoadedMessageChatIds({});
        chatAppCache.hasLoadedChats = true;
        return;
      }
      setChats(baseChats);
      setChatMessagePagination(
        Object.fromEntries(
          baseChats.map((chat) => [
            chat.id,
            {
              oldestSequenceNumber: null,
              hasOlder: false,
              isLoading: false,
            } as ChatMessagePaginationState,
          ]),
        ),
      );
      setActiveChatId((prev) => {
        if (baseChats.length === 0) {
          return null;
        }

        if (prev && baseChats.some((chat) => chat.id === prev)) {
          return prev;
        }

        return baseChats[0].id;
      });
      chatAppCache.hasLoadedChats = true;
    };

    void loadChats();

    return () => {
      cancelled = true;
    };
  }, [authResolved, resolvedUserId, session?.access_token]);

  const loadLatestMessagesForChat = useCallback(async (chatId: string) => {
    setChatMessagePagination((prev) => ({
      ...prev,
      [chatId]: {
        oldestSequenceNumber: prev[chatId]?.oldestSequenceNumber ?? null,
        hasOlder: prev[chatId]?.hasOlder ?? false,
        isLoading: true,
      },
    }));

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content, created_at, version_group_id, sequence_number")
        .eq("chat_id", chatId)
        .eq("is_active", true)
        .order("sequence_number", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (error) {
        console.error("Failed to load latest chat messages from Supabase.", error);
        return;
      }

      const descRows = (data ?? []) as ChatMessageRow[];
      const ascRows = [...descRows].reverse();
      const versionGroupIds = [...new Set(ascRows.map((row) => row.version_group_id))];
      const { data: versionRows, error: versionError } = versionGroupIds.length
        ? await supabase
          .from("messages")
          .select("id, created_at, version_group_id")
          .in("version_group_id", versionGroupIds)
          .order("created_at", { ascending: true })
        : { data: [], error: null };

      if (versionError) {
        console.error("Failed to load chat message versions from Supabase.", versionError);
        return;
      }

      const mappedMessages = mapRowsToChatMessages(
        ascRows,
        buildVersionsByGroup((versionRows ?? []) as MessageVersionRow[]),
      );

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: mappedMessages,
              }
            : chat,
        ),
      );
      setLoadedMessageChatIds((prev) => ({
        ...prev,
        [chatId]: true,
      }));

      setChatMessagePagination((prev) => ({
        ...prev,
        [chatId]: {
          oldestSequenceNumber: ascRows[0]?.sequence_number ?? null,
          hasOlder: descRows.length === MESSAGE_PAGE_SIZE,
          isLoading: false,
        },
      }));
    } catch (error) {
      console.error("Failed to load latest messages.", error);
      setChatMessagePagination((prev) => ({
        ...prev,
        [chatId]: {
          oldestSequenceNumber: prev[chatId]?.oldestSequenceNumber ?? null,
          hasOlder: prev[chatId]?.hasOlder ?? false,
          isLoading: false,
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (!authResolved || !resolvedUserId || !session?.access_token || !activeChatId) {
      return;
    }

    if (loadedMessageChatIds[activeChatId]) {
      return;
    }

    void loadLatestMessagesForChat(activeChatId);
  }, [activeChatId, authResolved, loadLatestMessagesForChat, loadedMessageChatIds, resolvedUserId, session?.access_token]);

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
  const selectorChat = chats.find((chat) => chat.id === chatOptionSelector?.chatId) ?? null;
  const activeChatInputLocked = Boolean(activeChat && !activeChat.apiProfileId);
  const shouldShowSetupRequired =
    activeChatInputLocked && (activeChat?.messages.length ?? 0) === 0;
  const hasApiProfiles = apiProfiles.length > 0;
  const activeInstructionPreset = instructionPresets.find(
    (preset) => preset.id === activeChat?.instructionPresetId,
  );
  const activeCharacterPreset = characterPresets.find(
    (preset) => preset.id === activeChat?.characterPresetId,
  );
  const activeChatModelLabel = isPreviewMode
    ? "Preview mode · Sign in to start chatting and save your story"
    : [
        activeChatApiProfile
          ? `${activeChatApiProfile.name} (${activeChatApiProfile.model || "Model not set"})`
          : "No API profile selected",
        activeInstructionPreset?.name ?? "No instruction preset",
        activeCharacterPreset?.name ?? "No character preset",
      ].join(" · ");
  const isActiveChatThinking = Boolean(activeChat && thinkingChatId === activeChat.id);

  const createChatRecord = useCallback(async (): Promise<ChatSession | null> => {
    if (!requireAuth()) {
      return null;
    }

    if (!user) {
      console.error("Cannot create chat: no authenticated user.");
      return null;
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
      return null;
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

    return newChat;
  }, [requireAuth, user]);

  const handleNewChat = async () => {
    await createChatRecord();
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

  const handleLoadOlderMessages = useCallback(async () => {
    if (!activeChatId) {
      return;
    }

    const pagination = chatMessagePagination[activeChatId];
    if (!pagination || pagination.isLoading || !pagination.hasOlder) {
      return;
    }

    if (!pagination.oldestSequenceNumber) {
      setChatMessagePagination((prev) => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          hasOlder: false,
          isLoading: false,
        },
      }));
      return;
    }

    setChatMessagePagination((prev) => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        isLoading: true,
      },
    }));

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content, created_at, version_group_id, sequence_number")
        .eq("chat_id", activeChatId)
        .eq("is_active", true)
        .lt("sequence_number", pagination.oldestSequenceNumber)
        .order("sequence_number", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE);

      if (error) {
        console.error("Failed to load older chat messages from Supabase.", error);
        setChatMessagePagination((prev) => ({
          ...prev,
          [activeChatId]: {
            ...prev[activeChatId],
            isLoading: false,
          },
        }));
        return;
      }

      const descRows = (data ?? []) as ChatMessageRow[];
      const ascRows = [...descRows].reverse();
      const versionGroupIds = [...new Set(ascRows.map((row) => row.version_group_id))];
      const { data: versionRows, error: versionError } = versionGroupIds.length
        ? await supabase
          .from("messages")
          .select("id, created_at, version_group_id")
          .in("version_group_id", versionGroupIds)
          .order("created_at", { ascending: true })
        : { data: [], error: null };

      if (versionError) {
        console.error("Failed to load older message versions from Supabase.", versionError);
        setChatMessagePagination((prev) => ({
          ...prev,
          [activeChatId]: {
            ...prev[activeChatId],
            isLoading: false,
          },
        }));
        return;
      }

      const olderMessages = mapRowsToChatMessages(
        ascRows,
        buildVersionsByGroup((versionRows ?? []) as MessageVersionRow[]),
      );

      if (olderMessages.length > 0) {
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId
              ? {
                  ...chat,
                  messages: [...olderMessages, ...chat.messages],
                }
              : chat,
          ),
        );
      }

      setChatMessagePagination((prev) => ({
        ...prev,
        [activeChatId]: {
          oldestSequenceNumber:
            ascRows[0]?.sequence_number ?? pagination.oldestSequenceNumber,
          hasOlder: descRows.length === MESSAGE_PAGE_SIZE,
          isLoading: false,
        },
      }));
    } catch (error) {
      console.error("Failed to load older messages.", error);
      setChatMessagePagination((prev) => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          isLoading: false,
        },
      }));
    }
  }, [activeChatId, chatMessagePagination]);

  const handleDeleteChat = async (chatId: string) => {
    if (!requireAuth()) {
      return;
    }

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

    if (thinkingChatId === chatId) {
      setThinkingChatId(null);
    }
    if (chatOptionSelector?.chatId === chatId) {
      setChatOptionSelector(null);
    }
  };

  const handleRenameChat = async (chatId: string, title: string) => {
    if (!requireAuth()) {
      return;
    }

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
          versionGroupId: string;
          sequenceNumber: number;
          versions: MessageVersion[];
          activeVersionIndex: number;
        }) => ({
          id: message.id,
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
          createdAt:
            typeof message.createdAt === "number" ? message.createdAt : Date.now(),
          versionGroupId: message.versionGroupId,
          sequenceNumber: message.sequenceNumber,
          versions: message.versions,
          activeVersionIndex: message.activeVersionIndex,
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
      setChatMessagePagination((prev) => ({
        ...prev,
        [chatId]: {
          oldestSequenceNumber: mappedMessages[0]?.sequenceNumber ?? null,
          hasOlder: true,
          isLoading: false,
        },
      }));
    } catch (error) {
      console.error("Story summarization failed", error);
    }
  }, [setChats]);

  const handleSlashCommand = async (commandId: string) => {
    if (!requireAuth()) {
      return;
    }

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
    if (!requireAuth()) {
      return;
    }

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
    const nextSequenceNumber =
      (targetChat.messages[targetChat.messages.length - 1]?.sequenceNumber ?? 0) + 1;

    const now = Date.now();

    const userMessage = createSingleVersionMessage({
      id: createId(),
      role: "user",
      content,
      createdAt: now,
      sequenceNumber: nextSequenceNumber,
    });

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

      const canonicalUserMessage = payload.userMessage
        ? createSingleVersionMessage({
          id: payload.userMessage.id,
          role: "user",
          content: payload.userMessage.content,
          createdAt:
            typeof payload.userMessage.createdAt === "number"
              ? payload.userMessage.createdAt
              : now,
          sequenceNumber:
            typeof payload.userMessage.sequenceNumber === "number"
              ? payload.userMessage.sequenceNumber
              : nextSequenceNumber,
          versionGroupId: payload.userMessage.versionGroupId,
        })
        : userMessage;

      const assistantMessage = payload.assistantMessage
        ? createSingleVersionMessage({
          id: payload.assistantMessage.id,
          role: "assistant",
          content: payload.assistantMessage.content,
          createdAt:
            typeof payload.assistantMessage.createdAt === "number"
              ? payload.assistantMessage.createdAt
              : Date.now(),
          sequenceNumber:
            typeof payload.assistantMessage.sequenceNumber === "number"
              ? payload.assistantMessage.sequenceNumber
              : nextSequenceNumber + 1,
          versionGroupId: payload.assistantMessage.versionGroupId,
        })
        : createSingleVersionMessage({
          id: createId(),
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          sequenceNumber: nextSequenceNumber + 1,
        });

      setChats((prev) =>
        prev.map((chat, index) => {
          if (chat.id !== requestChatId) {
            return chat;
          }

          const existingMessages = [...chat.messages];
          const optimisticUserIndex = [...existingMessages]
            .reverse()
            .findIndex((message) => message.id === userMessage.id);

          if (optimisticUserIndex >= 0) {
            existingMessages[existingMessages.length - 1 - optimisticUserIndex] =
              canonicalUserMessage;
          } else {
            existingMessages.push(canonicalUserMessage);
          }

          const nextMessages = [...existingMessages, assistantMessage];
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
      const assistantMessage = createSingleVersionMessage({
        id: createId(),
        role: "assistant",
        content:
          error instanceof Error
            ? `Request failed: ${error.message}`
            : "Request failed: unknown error",
        createdAt: Date.now(),
        sequenceNumber: nextSequenceNumber + 1,
      });

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

  const handleApplyMessageMutation = async (params: {
    messageId?: string;
    targetVersionId?: string;
    content?: string;
  }) => {
    if (!requireAuth()) {
      return;
    }

    if (!activeChat) {
      return;
    }

    const selectedInstructionPreset = instructionPresets.find(
      (preset) => preset.id === activeChat.instructionPresetId,
    );
    const selectedCharacterPreset = characterPresets.find(
      (preset) => preset.id === activeChat.characterPresetId,
    );

    setThinkingChatId(activeChat.id);

    try {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError || !authData.session?.access_token) {
        throw new Error("Unable to resolve authenticated session.");
      }

      const response = await fetch("/api/chat/messages", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          chatId: activeChat.id,
          messageId: params.messageId,
          targetVersionId: params.targetVersionId,
          content: params.content,
          instructionContent: selectedInstructionPreset?.content,
          characterContent: selectedCharacterPreset?.content,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Failed to update message version.",
        );
      }

      const mappedMessages: ChatMessage[] = Array.isArray(payload.messages)
        ? payload.messages.map((message: ChatMessage) => ({
          ...message,
          role: message.role === "assistant" ? "assistant" : "user",
        }))
        : [];

      setChats((prev) =>
        prev.map((chat, index) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages: mappedMessages,
                storySummary: null,
                title: buildChatTitle(mappedMessages, index + 1),
                updatedAt:
                  typeof payload.updatedAt === "number"
                    ? payload.updatedAt
                    : Date.now(),
              }
            : chat,
        ),
      );
      setChatMessagePagination((prev) => ({
        ...prev,
        [activeChat.id]: {
          oldestSequenceNumber: mappedMessages[0]?.sequenceNumber ?? null,
          hasOlder: false,
          isLoading: false,
        },
      }));
    } catch (error) {
      console.error("Failed to mutate chat message.", error);
    } finally {
      setThinkingChatId((prev) => (prev === activeChat.id ? null : prev));
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    await handleApplyMessageMutation({
      messageId,
      content,
    });
  };

  const handleActivateMessageVersion = async (targetVersionId: string) => {
    await handleApplyMessageMutation({
      targetVersionId,
    });
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
      if (!requireAuth()) {
        return;
      }

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
      if (!requireAuth()) {
        return;
      }

      setPresets((prev) =>
        prev.map((preset) =>
          preset.id === presetId ? { ...preset, ...updates } : preset,
        ),
      );
    };

    const deletePreset = (presetId: string) => {
      if (!requireAuth()) {
        return;
      }

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

  const persistChatOptionSelection = async (
    chatId: string,
    values: {
      apiProfileId?: string | null;
      characterPresetId?: string | null;
      instructionPresetId?: string | null;
    },
  ) => {
    if (!requireAuth()) {
      return;
    }

    const updatePayload: {
      api_profile_id?: string | null;
      character_preset_id?: string | null;
      instruction_preset_id?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (Object.prototype.hasOwnProperty.call(values, "apiProfileId")) {
      updatePayload.api_profile_id = values.apiProfileId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(values, "characterPresetId")) {
      updatePayload.character_preset_id = values.characterPresetId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(values, "instructionPresetId")) {
      updatePayload.instruction_preset_id = values.instructionPresetId ?? null;
    }

    const { data, error } = await supabase
      .from("chats")
      .update(updatePayload)
      .eq("id", chatId)
      .select("api_profile_id, character_preset_id, instruction_preset_id, updated_at")
      .single();

    if (error || !data) {
      console.error("Failed to persist chat option.", error);
      return;
    }

    const updatedAt = Date.parse(data.updated_at);
    const fallbackUpdatedAt = Date.now();

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              apiProfileId: data.api_profile_id,
              characterPresetId: data.character_preset_id,
              instructionPresetId: data.instruction_preset_id,
              settingsConfigured: Boolean(data.api_profile_id),
              updatedAt: Number.isNaN(updatedAt) ? fallbackUpdatedAt : updatedAt,
            }
          : chat,
      ),
    );
  };

  const resolveSelectorChatId = useCallback(async (chatId: string | null) => {
    if (chatId) {
      return chatId;
    }

    const createdChat = await createChatRecord();
    return createdChat?.id ?? null;
  }, [createChatRecord]);

  const handleOpenApiProfileSelector = async (
    chatId: string | null,
    anchorRect: SelectorAnchorRect | null = null,
  ) => {
    if (!requireAuth()) {
      return;
    }

    if (!hasLoadedApiProfiles) {
      return;
    }

    if (!hasApiProfiles) {
      router.push("/settings?section=api");
      return;
    }

    const resolvedChatId = await resolveSelectorChatId(chatId);
    if (!resolvedChatId) {
      return;
    }

    setChatOptionSelector({ chatId: resolvedChatId, kind: "apiProfile", anchorRect });
  };

  const handleOpenCharacterPresetSelector = async (
    chatId: string | null,
    anchorRect: SelectorAnchorRect | null = null,
  ) => {
    if (!requireAuth()) {
      return;
    }

    const resolvedChatId = await resolveSelectorChatId(chatId);
    if (!resolvedChatId) {
      return;
    }

    setChatOptionSelector({ chatId: resolvedChatId, kind: "characterPreset", anchorRect });
  };

  const handleOpenInstructionPresetSelector = async (
    chatId: string | null,
    anchorRect: SelectorAnchorRect | null = null,
  ) => {
    if (!requireAuth()) {
      return;
    }

    const resolvedChatId = await resolveSelectorChatId(chatId);
    if (!resolvedChatId) {
      return;
    }

    setChatOptionSelector({ chatId: resolvedChatId, kind: "instructionPreset", anchorRect });
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
          isPreviewMode={isPreviewMode}
          onNewChat={handleNewChat}
          onViewChange={handleViewChange}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          onRequireAuth={requireAuth}
          className={`fixed inset-y-0 left-0 z-40 flex w-[85vw] max-w-72 flex-col bg-zinc-950 px-2 py-2 shadow-2xl transition-transform md:static md:z-auto md:w-full md:max-w-72 md:translate-x-0 md:bg-transparent md:shadow-none ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        />

        <section className="min-h-0 min-w-0 flex-1">
          {activeView === "chat" && (
            <ChatPanel
              chat={activeChat}
              modelLabel={activeChatModelLabel}
              apiProfileLabel={activeChatApiProfile?.name ?? "API profile"}
              characterPresetLabel={activeCharacterPreset?.name ?? "Character preset"}
              instructionPresetLabel={activeInstructionPreset?.name ?? "Instruction preset"}
              inputDisabled={activeChatInputLocked}
              authRequired={isPreviewMode}
              setupRequired={!isPreviewMode && shouldShowSetupRequired}
              hasApiProfiles={hasApiProfiles}
              isThinking={isActiveChatThinking}
              onSendMessage={handleSendMessage}
              onRunSlashCommand={handleSlashCommand}
              hasOlderMessages={Boolean(
                activeChatId && chatMessagePagination[activeChatId]?.hasOlder,
              )}
              isLoadingOlderMessages={Boolean(
                activeChatId && chatMessagePagination[activeChatId]?.isLoading,
              )}
              onLoadOlderMessages={handleLoadOlderMessages}
              onEditMessage={handleEditMessage}
              onActivateMessageVersion={handleActivateMessageVersion}
              onOpenApiProfileSelector={(anchorRect) => {
                void handleOpenApiProfileSelector(activeChat?.id ?? null, anchorRect ?? null);
              }}
              onOpenCharacterPresetSelector={(anchorRect) => {
                void handleOpenCharacterPresetSelector(activeChat?.id ?? null, anchorRect ?? null);
              }}
              onOpenInstructionPresetSelector={(anchorRect) => {
                void handleOpenInstructionPresetSelector(activeChat?.id ?? null, anchorRect ?? null);
              }}
              onRequireAuth={requireAuth}
            />
          )}

          {activeView === "instructionPresets" && (
            <InstructionPresetSelector
              presets={instructionPresetHandlers.presets}
              isReadOnly={isPreviewMode}
              onRequireAuth={requireAuth}
              onCreatePreset={instructionPresetHandlers.createPreset}
              onUpdatePreset={instructionPresetHandlers.updatePreset}
              onDeletePreset={instructionPresetHandlers.deletePreset}
            />
          )}

          {activeView === "characterPresets" && (
            <CharacterPresetSelector
              presets={characterPresetHandlers.presets}
              isReadOnly={isPreviewMode}
              onRequireAuth={requireAuth}
              onCreatePreset={characterPresetHandlers.createPreset}
              onUpdatePreset={characterPresetHandlers.updatePreset}
              onDeletePreset={characterPresetHandlers.deletePreset}
            />
          )}

        </section>
      </div>
      <ChatOptionSelectorModal
        open={chatOptionSelector?.kind === "apiProfile" && selectorChat !== null}
        title="API Profile"
        description="Choose which model profile this chat should use."
        selectedId={selectorChat?.apiProfileId ?? null}
        anchorRect={chatOptionSelector?.anchorRect ?? null}
        options={apiProfiles.map((profile) => ({
          id: profile.id,
          label: profile.name,
          description: [profile.provider, profile.model].filter(Boolean).join(" · "),
        }))}
        emptyStateTitle="No API profiles yet."
        emptyStateDescription="Create an API profile in settings to start chatting with this conversation."
        settingsHref="/settings?section=api"
        createHref="/settings?section=api"
        createLabel="New API Profile"
        onClose={() => setChatOptionSelector(null)}
        onSelect={(value) => {
          if (selectorChat) {
            void persistChatOptionSelection(selectorChat.id, { apiProfileId: value });
          }
        }}
      />

      <ChatOptionSelectorModal
        open={chatOptionSelector?.kind === "characterPreset" && selectorChat !== null}
        title="Character Preset"
        description="Pick the active character context for this chat."
        selectedId={selectorChat?.characterPresetId ?? null}
        anchorRect={chatOptionSelector?.anchorRect ?? null}
        options={characterPresets.map((preset) => ({
          id: preset.id,
          label: preset.name,
        }))}
        allowNone
        noneLabel="No character preset"
        createHref="/?view=characterPresets"
        createLabel="New Character Preset"
        onClose={() => setChatOptionSelector(null)}
        onSelect={(value) => {
          if (selectorChat) {
            void persistChatOptionSelection(selectorChat.id, { characterPresetId: value });
          }
        }}
      />

      <ChatOptionSelectorModal
        open={chatOptionSelector?.kind === "instructionPreset" && selectorChat !== null}
        title="Instruction Preset"
        description="Pick the active instruction set for this chat."
        selectedId={selectorChat?.instructionPresetId ?? null}
        anchorRect={chatOptionSelector?.anchorRect ?? null}
        options={instructionPresets.map((preset) => ({
          id: preset.id,
          label: preset.name,
        }))}
        allowNone
        noneLabel="No instruction preset"
        createHref="/?view=instructionPresets"
        createLabel="New Instruction Preset"
        onClose={() => setChatOptionSelector(null)}
        onSelect={(value) => {
          if (selectorChat) {
            void persistChatOptionSelection(selectorChat.id, { instructionPresetId: value });
          }
        }}
      />
    </main>
  );
}
