export type Role = "user" | "assistant";

export type SidebarView =
  | "chat"
  | "instructionPresets"
  | "characterPresets"
  | "history";

export type Provider = "OpenAI" | "Anthropic" | "Google";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Preset {
  id: string;
  name: string;
  content: string;
}

export interface AppSettings {
  apiKey: string;
  provider: Provider;
  model: string;
}

