"use client";

export interface AdminTab {
  id: string;
  label: string;
  description: string;
}

export const ADMIN_TABS: AdminTab[] = [
  { id: "general", label: "General", description: "ICP weights, verticals, company size, signals, team members, exclusions, and presets." },
  { id: "pipeline", label: "Pipeline", description: "Scoring tuning, email verification, export settings, and copy format configuration." },
  { id: "system", label: "System", description: "Rate limits, data retention, notifications, and cache settings." },
  { id: "api-keys", label: "API Keys", description: "Manage API keys for Exa, Apollo, HubSpot, Clearout, and custom sources." },
  { id: "auth", label: "Auth", description: "Authentication settings, session management, and activity log." },
  { id: "email-prompts", label: "Email Prompts", description: "Configure LLM prompts, tone instructions, and email templates." },
  { id: "ui", label: "UI", description: "Panel widths, default view mode, auto-refresh, confidence badges, and data sources." },
  { id: "analytics", label: "Analytics", description: "KPIs, discovery funnel, team activity, source performance, and exclusion insights." },
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
