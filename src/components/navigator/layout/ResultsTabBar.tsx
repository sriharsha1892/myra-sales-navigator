"use client";

import React, { useState, useCallback } from "react";
import { ViewToggle } from "@/components/navigator/shared";
import { CreditUsageIndicator } from "@/components/navigator/CreditUsageIndicator";
import { getTheme, setTheme } from "@/lib/theme";
import type { SortField, ViewMode } from "@/lib/navigator/types";

interface ResultsTabBarProps {
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  companyCount: number;
  prospectCount: number;
  selectedCompanyCount: number;
  searchLoading: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onSortChange: (field: SortField) => void;
  onSortDirectionToggle: () => void;
  onDeselectAll: () => void;
}

export const ResultsTabBar = React.memo(function ResultsTabBar({
  viewMode,
  sortField,
  sortDirection,
  companyCount,
  prospectCount,
  selectedCompanyCount,
  searchLoading,
  onViewModeChange,
  onSortChange,
  onSortDirectionToggle,
  onDeselectAll,
}: ResultsTabBarProps) {
  const [currentTheme, setCurrentTheme] = useState(() =>
    typeof window !== "undefined" ? getTheme() : "light"
  );
  const toggleTheme = useCallback(() => {
    const next = currentTheme === "dark" ? "light" : "dark";
    setTheme(next);
    setCurrentTheme(next);
  }, [currentTheme]);

  return (
    <div className="ambient-header relative bg-surface-0 border-b border-surface-3 flex flex-shrink-0 flex-wrap items-center gap-3 px-4 py-2.5">
      {searchLoading && (
        <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-accent-primary/10">
          <div className="h-full w-1/4 bg-accent-primary" style={{ animation: "progressSlide 1.2s ease-in-out infinite" }} />
        </div>
      )}
      <ViewToggle
        value={viewMode}
        onChange={onViewModeChange}
        companyCount={companyCount}
        prospectCount={prospectCount}
      />
      {/* Bulk selection count indicator */}
      {selectedCompanyCount > 0 && (
        <>
          <div className="h-3.5 w-px bg-surface-3" />
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
        {viewMode === "companies" && (
          <>
            {/* Sort — dot-separated text links */}
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
                aria-label={sortDirection === "desc" ? "Descending" : "Ascending"}
              >
                {sortDirection === "desc" ? "\u2193" : "\u2191"}
              </button>
            </div>
          </>
        )}
        <CreditUsageIndicator />
        <button
          onClick={toggleTheme}
          className="btn-press rounded-input border border-surface-3 bg-surface-2 p-1.5 text-text-secondary transition-all duration-[180ms] hover:border-accent-primary/40 hover:text-text-primary"
          aria-label={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${currentTheme === "dark" ? "light" : "dark"} mode`}
        >
          {currentTheme === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
});
