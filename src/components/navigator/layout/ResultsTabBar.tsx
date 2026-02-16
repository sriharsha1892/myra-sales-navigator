"use client";

import React from "react";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import { CreditUsageIndicator } from "@/components/navigator/CreditUsageIndicator";
import { useStore } from "@/lib/navigator/store";
import type { SortField } from "@/lib/navigator/types";

interface ResultsTabBarProps {
  sortField: SortField;
  sortDirection: "asc" | "desc";
  selectedCompanyCount: number;
  searchLoading: boolean;
  onSortChange: (field: SortField) => void;
  onSortDirectionToggle: () => void;
  onDeselectAll: () => void;
}

export const ResultsTabBar = React.memo(function ResultsTabBar({
  sortField,
  sortDirection,
  selectedCompanyCount,
  searchLoading,
  onSortChange,
  onSortDirectionToggle,
  onDeselectAll,
}: ResultsTabBarProps) {
  const cardDensity = useStore((s) => s.cardDensity);

  return (
    <div className="relative bg-surface-0 border-b border-surface-3 flex flex-shrink-0 flex-wrap items-center gap-3 px-4 py-2.5">
      {searchLoading && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-accent-primary/10">
          <div className="h-full w-1/4 bg-accent-primary" style={{ animation: "progressSlide 1.2s ease-in-out infinite" }} />
        </div>
      )}
      {/* Bulk selection count indicator */}
      {selectedCompanyCount > 0 && (
        <>
          <span className="flex items-center gap-1.5 rounded-pill bg-accent-primary/10 px-2 py-0.5 text-xs text-accent-primary">
            {selectedCompanyCount} selected
            <button
              onClick={onDeselectAll}
              className="ml-0.5 text-accent-primary/60 transition-colors hover:text-accent-primary"
              aria-label="Clear selection"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        </>
      )}
      <div className="ml-auto flex items-center gap-3">
        {/* Sort — dot-separated text links (hidden in table mode — table has column headers) */}
        {cardDensity !== "table" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase tracking-[0.06em] text-text-secondary">Sort</span>
            <div className="flex items-center">
              {(["icp_score", "name", "employee_count"] as SortField[]).map((field, i) => {
                const labels: Record<SortField, string> = { icp_score: "Score", name: "Name", employee_count: "Size", relevance: "Relevance" };
                const sortIcons: Record<SortField, string> = { icp_score: "\u2605", name: "Az", employee_count: "\u2195", relevance: "\u2261" };
                const isActive = sortField === field;
                return (
                  <span key={field} className="flex items-center">
                    {i > 0 && <span className="mx-1 text-text-tertiary/40">&middot;</span>}
                    <button
                      onClick={() => onSortChange(field)}
                      className={`rounded px-1.5 py-0.5 text-xs transition-all duration-[180ms] ${
                        isActive
                          ? "bg-surface-2 font-semibold text-text-primary"
                          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      }`}
                    >
                      <span className="mr-0.5 opacity-60">{sortIcons[field]}</span>{labels[field]}
                    </button>
                  </span>
                );
              })}
            </div>
            <button
              onClick={onSortDirectionToggle}
              className="btn-press text-xs text-text-tertiary hover:text-text-primary transition-colors duration-[180ms]"
              aria-label={`Sort ${({ icp_score: "Score", name: "Name", employee_count: "Size", relevance: "Relevance" } as Record<SortField, string>)[sortField]} ${sortDirection === "desc" ? "ascending" : "descending"}`}
            >
              {sortDirection === "desc" ? "\u2193" : "\u2191"}
            </button>
          </div>
        )}
        <DensityToggle />
        <CreditUsageIndicator />
      </div>
    </div>
  );
});

function DensityToggle() {
  const cardDensity = useStore((s) => s.cardDensity);
  const setCardDensity = useStore((s) => s.setCardDensity);

  const cycleNext = () => {
    const order = ["comfortable", "compact", "table"] as const;
    const idx = order.indexOf(cardDensity);
    setCardDensity(order[(idx + 1) % order.length]);
  };

  const labels: Record<string, string> = {
    comfortable: "Compact view",
    compact: "Table view",
    table: "Comfortable view",
  };

  return (
    <Tooltip text={labels[cardDensity] ?? "Change view"}>
      <button
        onClick={cycleNext}
        className="btn-press text-text-tertiary hover:text-text-primary transition-colors duration-[180ms]"
        aria-label={labels[cardDensity]}
      >
        {cardDensity === "table" ? (
          /* 4x3 grid — spreadsheet icon */
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="2" width="4" height="3" rx="0.5" />
            <rect x="8" y="2" width="4" height="3" rx="0.5" />
            <rect x="2" y="7" width="4" height="3" rx="0.5" />
            <rect x="8" y="7" width="4" height="3" rx="0.5" />
            <rect x="2" y="12" width="4" height="2" rx="0.5" />
            <rect x="8" y="12" width="4" height="2" rx="0.5" />
          </svg>
        ) : cardDensity === "compact" ? (
          /* 4 thin evenly spaced lines — compact icon */
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="3" x2="14" y2="3" />
            <line x1="2" y1="6.33" x2="14" y2="6.33" />
            <line x1="2" y1="9.67" x2="14" y2="9.67" />
            <line x1="2" y1="13" x2="14" y2="13" />
          </svg>
        ) : (
          /* 3 lines with different lengths — comfortable/list icon */
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="11" y2="8" />
            <line x1="2" y1="12" x2="13" y2="12" />
          </svg>
        )}
      </button>
    </Tooltip>
  );
}
