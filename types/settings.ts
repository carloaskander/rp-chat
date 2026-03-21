export interface ApiProfile {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
}

export type SettingsTab = "account" | "api" | "appearance" | "about";
