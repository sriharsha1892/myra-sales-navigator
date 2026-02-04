"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/navigator/store";
import type { SignalType } from "@/lib/navigator/types";

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
        <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-input px-2 py-1.5 hover:bg-surface-2">
          <input
            type="checkbox"
            checked={activeSignals.includes(key)}
            onChange={() => toggle(key)}
            className="h-4 w-4 rounded accent-accent-primary"
          />
          <span className={cn("text-sm capitalize", activeSignals.includes(key) ? "text-text-primary font-medium" : "text-text-secondary")}>
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}
