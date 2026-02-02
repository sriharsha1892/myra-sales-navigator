"use client";

export interface AdminTab {
  id: string;
  label: string;
}

export const ADMIN_TABS: AdminTab[] = [
  { id: "general", label: "General" },
  { id: "api-keys", label: "API Keys" },
  { id: "data-sources", label: "Data Sources" },
  { id: "export", label: "Export" },
  { id: "verification", label: "Verification" },
  { id: "scoring", label: "Scoring" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "notifications", label: "Notifications" },
  { id: "retention", label: "Retention" },
  { id: "auth", label: "Auth" },
  { id: "ui", label: "UI" },
  { id: "email-prompts", label: "Email Prompts" },
  { id: "analytics", label: "Analytics" },
];

interface AdminTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-1 rounded-card border border-surface-3 bg-surface-1 p-1">
      {ADMIN_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`rounded-input px-3 py-1.5 text-xs font-medium transition-all duration-180 ${
            activeTab === tab.id
              ? "bg-accent-primary text-text-inverse"
              : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
