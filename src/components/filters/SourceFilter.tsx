"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import type { ResultSource } from "@/lib/types";

const sources: { key: ResultSource; label: string; activeColor: string }[] = [
  { key: "exa", label: "Exa", activeColor: "border-source-exa bg-info-light text-source-exa" },
  { key: "apollo", label: "Apollo", activeColor: "border-source-apollo bg-warning-light text-source-apollo" },
  { key: "hubspot", label: "HubSpot", activeColor: "border-source-hubspot bg-accent-highlight-light text-source-hubspot" },
  { key: "freshsales", label: "Freshsales", activeColor: "border-source-freshsales bg-source-freshsales-light text-source-freshsales" },
];

export function SourceFilter() {
  const activeSources = useStore((s) => s.filters.sources);
  const setFilters = useStore((s) => s.setFilters);

  const toggle = (source: ResultSource) => {
    const next = activeSources.includes(source)
      ? activeSources.filter((s) => s !== source)
      : [...activeSources, source];
    setFilters({ sources: next });
  };

  return (
    <div className="flex gap-1.5">
      {sources.map(({ key, label, activeColor }) => {
        const active = activeSources.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={cn(
              "rounded-pill border px-2.5 py-1 text-xs font-medium transition-all duration-[var(--transition-default)]",
              active ? activeColor : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
