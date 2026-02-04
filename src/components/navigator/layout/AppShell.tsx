"use client";

import React from "react";
import { useStore } from "@/lib/navigator/store";
import { FilterPanel } from "./FilterPanel";
import { ResultsList } from "./ResultsList";
import { SlideOverPane } from "./SlideOverPane";
import { DetailPlaceholder } from "./DetailPlaceholder";

export function AppShell() {
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const searchResults = useStore((s) => s.searchResults);
  const detailPaneCollapsed = useStore((s) => s.detailPaneCollapsed);
  const toggleDetailPane = useStore((s) => s.toggleDetailPane);

  const showDetailColumn = searchResults !== null && searchResults.length > 0;

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Sidebar / Filter Panel */}
      <div className="w-[220px] flex-shrink-0 overflow-hidden border-r border-surface-3">
        <FilterPanel />
      </div>

      {/* Main results area */}
      <div className="min-w-0 flex-1">
        <ResultsList />
      </div>

      {/* Collapsible detail column */}
      {showDetailColumn && (
        <div
          className={`relative flex-shrink-0 border-l border-surface-3 transition-all duration-300 ease-out ${
            detailPaneCollapsed ? "w-0 overflow-hidden" : "w-[420px]"
          }`}
        >
          {/* Collapse toggle chevron */}
          <button
            onClick={toggleDetailPane}
            className="absolute -left-3 top-1/2 z-30 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-surface-3 bg-surface-1 text-text-tertiary shadow-sm transition-colors hover:text-text-primary hover:bg-surface-2"
            title={detailPaneCollapsed ? "Expand detail pane" : "Collapse detail pane"}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${detailPaneCollapsed ? "rotate-180" : ""}`}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {!detailPaneCollapsed && (
            <div style={{ animation: "columnReveal 250ms ease-out" }}>
              {selectedCompanyDomain ? (
                <DossierErrorBoundary>
                  <SlideOverPane />
                </DossierErrorBoundary>
              ) : (
                <DetailPlaceholder />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

class DossierErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-[420px] flex-col items-center justify-center gap-3 bg-surface-0 px-6">
          <p className="text-sm text-text-secondary">Something went wrong loading the dossier.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
