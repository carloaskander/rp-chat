import { AppSettings, ChatSession, Preset, Provider } from "@/types/chat";

import { createId } from "./chat-utils";

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  OpenAI: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  Anthropic: ["claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"],
  Google: ["gemini-2.0-flash", "gemini-2.0-pro"],
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  provider: "OpenAI",
  model: PROVIDER_MODELS.OpenAI[0],
};

export const DEFAULT_INSTRUCTION_PRESETS: Preset[] = [
  {
    id: createId(),
    name: "Storyteller",
    content: "Respond in descriptive prose, keeping continuity between turns.",
  },
  {
    id: createId(),
    name: "Rules-Light",
    content: "Keep responses concise, prioritize player agency, and avoid railroading.",
  },
];

export const DEFAULT_CHARACTER_PRESETS: Preset[] = [
  {
    id: createId(),
    name: "Cyber Detective",
    content: "A calm investigator with dry humor and strong pattern recognition.",
  },
  {
    id: createId(),
    name: "Fantasy Mage",
    content: "An archivist mage who speaks formally and values forgotten lore.",
  },
];

const now = Date.now();

export const DEFAULT_CHAT_SESSIONS: ChatSession[] = [
  {
    id: createId(),
    title: "Welcome",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: createId(),
        role: "assistant",
        content:
          "Welcome to RP Chat MVP. This prototype stores chats, presets, and settings in localStorage.",
        createdAt: now,
      },
    ],
  },
];

