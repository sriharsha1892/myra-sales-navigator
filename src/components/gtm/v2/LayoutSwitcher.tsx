"use client";

import { cn } from "@/lib/cn";

export type DashboardLayout = "expanded" | "compact" | "executive";

interface LayoutSwitcherProps {
  value: DashboardLayout;
  onChange: (layout: DashboardLayout) => void;
}

const LAYOUTS: { key: DashboardLayout; label: string; title: string }[] = [
  { key: "expanded", label: "Full", title: "Expanded view" },
  { key: "compact", label: "Grid", title: "Compact 2-column view" },
  { key: "executive", label: "Exec", title: "Executive summary" },
];

export function LayoutSwitcher({ value, onChange }: LayoutSwitcherProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
      {LAYOUTS.map(({ key, label, title }) => (
        <button
          key={key}
          title={title}
          onClick={() => onChange(key)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-[180ms]",
            value === key
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
