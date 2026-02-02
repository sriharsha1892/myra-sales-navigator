"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import type { SignalType } from "@/lib/types";

const signalTypes: { key: SignalType; label: string }[] = [
  { key: "hiring", label: "Hiring" },
  { key: "funding", label: "Funding" },
  { key: "expansion", label: "Expansion" },
  { key: "news", label: "News" },
];

export function SignalFilter() {
  const activeSignals = useStore((s) => s.filters.signals);
  const setFilters = useStore((s) => s.setFilters);

  const toggle = (signal: SignalType) => {
    const next = activeSignals.includes(signal)
      ? activeSignals.filter((s) => s !== signal)
      : [...activeSignals, signal];
    setFilters({ signals: next });
  };

  return (
    <div className="space-y-0.5">
      {signalTypes.map(({ key, label }) => (
        <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 hover:bg-surface-hover">
          <input
            type="checkbox"
            checked={activeSignals.includes(key)}
            onChange={() => toggle(key)}
            className="h-3 w-3 rounded accent-accent-primary"
          />
          <span className={cn("text-xs capitalize", activeSignals.includes(key) ? "text-text-primary" : "text-text-secondary")}>
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}
