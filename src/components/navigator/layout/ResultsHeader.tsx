"use client";

import React from "react";
import { ActiveFilterPills } from "@/components/navigator/shared/ActiveFilterPills";

interface ResultsHeaderProps {
  hasSearched: boolean;
  searchLoading: boolean;
  lastSearchQuery: string | null;
  companyCount: number;
  lastExcludedCount: number;
  searchError: string | null;
}

export const ResultsHeader = React.memo(function ResultsHeader({
  hasSearched,
  searchLoading,
  lastSearchQuery,
  companyCount,
  lastExcludedCount,
  searchError,
}: ResultsHeaderProps) {
  return (
    <>
      {/* Persistent search query header */}
      {(hasSearched || searchLoading) && lastSearchQuery && (
        <div className="sticky top-0 z-20 flex flex-shrink-0 items-center gap-2 border-b border-surface-3 bg-surface-1/80 backdrop-blur-sm px-4 py-1.5">
          <span className="text-xs text-text-tertiary">Results for</span>
          <span className="font-mono text-xs text-text-secondary">&ldquo;{lastSearchQuery}&rdquo;</span>
          {!searchLoading && companyCount > 0 && (
            <span className="text-xs text-text-tertiary">
              ({companyCount} companies{lastExcludedCount > 0 ? `, ${lastExcludedCount} excluded` : ""})
            </span>
          )}
        </div>
      )}

      {/* Sticky active filter pills */}
      {(hasSearched || searchLoading) && (
        <div className="sticky top-0 z-10 flex flex-shrink-0 border-b border-surface-3 bg-surface-0 px-4 py-2">
          <ActiveFilterPills />
        </div>
      )}

      {/* Error banner */}
      {searchError && (
        <div className="sticky top-0 z-20 flex-shrink-0 border-b border-danger/20 bg-danger-light px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{searchError}</span>
          </div>
        </div>
      )}
    </>
  );
});
