"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { ActiveFilterPills } from "@/components/navigator/shared/ActiveFilterPills";
import type { SearchErrorDetail } from "@/lib/navigator/types";

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
  const searchErrors = useStore((s) => s.searchErrors);
  const searchWarnings = useStore((s) => s.searchWarnings);
  const retryLastSearch = useStore((s) => s.retryLastSearch);
  const enrichmentProgress = useStore((s) => s.enrichmentProgress);
  const crmEnrichmentInProgress = useStore((s) => s.crmEnrichmentInProgress);
  const savePreset = useStore((s) => s.savePreset);
  const addToast = useStore((s) => s.addToast);

  const [showPresetForm, setShowPresetForm] = useState(false);
  const [presetName, setPresetName] = useState("");

  const hasStructuredErrors = searchErrors.length > 0;

  return (
    <>
      {/* Persistent search query header */}
      {(hasSearched || searchLoading) && lastSearchQuery && (
        <div className="sticky top-0 z-20 flex flex-shrink-0 flex-col border-b border-surface-3 bg-surface-1/80 backdrop-blur-sm px-4 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Results for</span>
            <span className="max-w-[360px] truncate inline-block align-bottom font-mono text-xs text-text-secondary" title={lastSearchQuery ?? undefined}>&ldquo;{lastSearchQuery}&rdquo;</span>
            {!searchLoading && companyCount > 0 && (
              <span className="text-xs text-text-tertiary">
                ({companyCount} companies{lastExcludedCount > 0 ? `, ${lastExcludedCount} excluded` : ""})
              </span>
            )}
            {!searchLoading && companyCount > 0 && !showPresetForm && (
              <button
                onClick={() => setShowPresetForm(true)}
                className="text-[10px] text-text-tertiary hover:text-accent-primary transition-colors"
              >
                Save as preset
              </button>
            )}
            {showPresetForm && (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (presetName.trim()) {
                    savePreset(presetName.trim());
                    addToast({ message: `Saved preset "${presetName.trim()}"`, type: "success", duration: 2000 });
                    setPresetName("");
                    setShowPresetForm(false);
                  }
                }}
              >
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name"
                  autoFocus
                  className="w-28 rounded-input border border-surface-3 bg-surface-0 px-2 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent-primary placeholder:text-text-tertiary"
                />
                <button
                  type="submit"
                  disabled={!presetName.trim()}
                  className="rounded-input bg-accent-primary px-2 py-0.5 text-[10px] font-medium text-surface-0 disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPresetForm(false); setPresetName(""); }}
                  className="text-[10px] text-text-tertiary hover:text-text-secondary"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
          {enrichmentProgress && (
            <div className="mt-1">
              <span className="text-[10px] text-text-tertiary">
                Enriching contacts {enrichmentProgress.completed}/{enrichmentProgress.total}...
              </span>
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  role="progressbar"
                  aria-valuenow={enrichmentProgress.completed}
                  aria-valuemin={0}
                  aria-valuemax={enrichmentProgress.total}
                  className="h-full bg-accent-secondary transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${(enrichmentProgress.completed / enrichmentProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          {crmEnrichmentInProgress && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-surface-3 border-t-accent-primary" />
              <span className="text-[10px] text-text-tertiary">Checking CRM status...</span>
            </div>
          )}
        </div>
      )}

      {/* Sticky active filter pills */}
      {(hasSearched || searchLoading) && (
        <div className="sticky top-0 z-10 flex flex-shrink-0 border-b border-surface-3 bg-surface-0 px-4 py-2">
          <ActiveFilterPills />
        </div>
      )}

      {/* Warnings banner (info style) */}
      {searchWarnings.length > 0 && (
        <div className="flex-shrink-0 border-b border-accent-secondary/20 bg-accent-secondary/5 px-4 py-2">
          {searchWarnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-accent-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Structured error banner (Phase 3) */}
      {hasStructuredErrors ? (
        <div role="alert" className="sticky top-0 z-20 flex-shrink-0 border-b border-danger/20 bg-danger/5 px-4 py-2">
          <div className="space-y-1.5">
            {searchErrors.map((err: SearchErrorDetail, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-danger">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {err.engine && (
                  <span className="rounded-pill border border-surface-3 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
                    {err.engine}
                  </span>
                )}
                <span className="text-danger">{err.message}</span>
                {err.retryable ? (
                  <button
                    onClick={retryLastSearch}
                    className="ml-auto rounded-input border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 text-[10px] font-medium text-accent-primary transition-colors hover:bg-accent-primary/20"
                  >
                    Retry
                  </button>
                ) : err.suggestedAction ? (
                  <span className="ml-auto text-[10px] text-text-tertiary">{err.suggestedAction}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : searchError ? (
        /* Legacy fallback error banner */
        <div role="alert" className="sticky top-0 z-20 flex-shrink-0 border-b border-danger/20 bg-danger-light px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{searchError}</span>
          </div>
        </div>
      ) : null}
    </>
  );
});
