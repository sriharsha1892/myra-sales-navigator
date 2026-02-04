"use client";

import { cn } from "@/lib/cn";

export type AdminTab =
  | "pipeline"
  | "cost"
  | "lead-gen"
  | "updates"
  | "snapshots";

const TABS: { key: AdminTab; label: string }[] = [
  { key: "pipeline", label: "Pipeline" },
  { key: "cost", label: "Cost" },
  { key: "lead-gen", label: "Lead Gen" },
  { key: "updates", label: "Updates" },
  { key: "snapshots", label: "Snapshots" },
];

interface AdminTabsProps {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}

export function AdminTabs({ active, onChange }: AdminTabsProps) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
            active === tab.key
              ? "bg-white text-gray-900 border border-b-0 border-gray-200 -mb-px"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
