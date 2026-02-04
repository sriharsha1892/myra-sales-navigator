"use client";

import { useRef, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import type { ExtractedEntities } from "@/lib/navigator/types";

export function ExtractedChips() {
  const extractedEntities = useStore((s) => s.extractedEntities);
  const setExtractedEntities = useStore((s) => s.setExtractedEntities);
  const setFilters = useStore((s) => s.setFilters);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleResearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPendingFilterSearch(true);
    }, 500);
  }, [setPendingFilterSearch]);

  const removeChip = useCallback(
    (category: keyof ExtractedEntities, value: string) => {
      if (!extractedEntities) return;
      const updated = {
        ...extractedEntities,
        [category]: extractedEntities[category].filter((v) => v !== value),
      };
      setExtractedEntities(updated);
      // Sync to filters
      setFilters({
        verticals: updated.verticals,
        regions: updated.regions,
      });
      scheduleResearch();
    },
    [extractedEntities, setExtractedEntities, setFilters, scheduleResearch]
  );

  if (!extractedEntities) return null;

  const hasAny =
    extractedEntities.verticals.length > 0 ||
    extractedEntities.regions.length > 0 ||
    extractedEntities.signals.length > 0;

  if (!hasAny) return null;

  const categories: { key: keyof ExtractedEntities; label: string; color: string }[] = [
    { key: "verticals", label: "Vertical", color: "border-accent-primary/40 text-accent-primary" },
    { key: "regions", label: "Region", color: "border-accent-secondary/40 text-accent-secondary" },
    { key: "signals", label: "Signal", color: "border-warning/40 text-warning" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-5 py-1.5">
      {categories.map(({ key, label, color }) =>
        extractedEntities[key].map((value) => (
          <span
            key={`${key}-${value}`}
            className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-medium ${color}`}
          >
            <span className="text-[9px] text-text-tertiary">{label}:</span>
            {value}
            <button
              onClick={() => removeChip(key, value)}
              className="ml-0.5 hover:text-danger"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))
      )}
      <button
        onClick={() => {
          setExtractedEntities(null);
          setFilters({ verticals: [], regions: [] });
        }}
        className="text-[10px] text-text-tertiary hover:text-text-secondary"
      >
        Clear all
      </button>
    </div>
  );
}
