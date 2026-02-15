import { SettingsTab } from "@/types/settings";

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs: Array<{ key: SettingsTab; label: string }> = [
  { key: "api", label: "API" },
  { key: "appearance", label: "Appearance" },
  { key: "advanced", label: "Advanced" },
  { key: "about", label: "About" },
];

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  return (
    <nav className="border-b border-zinc-800 px-5">
      <div className="flex flex-wrap gap-5">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`border-b-2 pb-2 pt-1 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? "border-zinc-200 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
      </div>
    </nav>
  );
}
