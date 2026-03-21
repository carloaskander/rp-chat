import { CircleUserRound, Info, Palette, Settings2, type LucideIcon } from "lucide-react";

import { SettingsTab } from "@/types/settings";

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs: Array<{ key: SettingsTab; label: string; description: string; icon: LucideIcon }> = [
  {
    key: "account",
    label: "Account",
    description: "Manage your signed-in account details.",
    icon: CircleUserRound,
  },
  {
    key: "api",
    label: "API Profiles",
    description: "Choose and manage your model provider profiles.",
    icon: Settings2,
  },
  {
    key: "appearance",
    label: "Appearance",
    description: "Theme and interface customization will live here.",
    icon: Palette,
  },
  {
    key: "about",
    label: "About",
    description: "Project details and environment context.",
    icon: Info,
  },
];

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <nav className="space-y-2 px-5" aria-label="Settings sections">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`flex w-full items-start gap-3 rounded-[18px] border px-4 py-3 text-left transition ${
              isActive
                ? "border-zinc-700 bg-zinc-900/90 text-zinc-100"
                : "border-zinc-900 bg-zinc-950/50 text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-200"
            }`}
          >
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${isActive ? "text-zinc-100" : "text-zinc-500"}`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{tab.label}</span>
              <span
                className={`mt-0.5 block text-xs ${isActive ? "text-zinc-400" : "text-zinc-500"}`}
              >
                {tab.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
