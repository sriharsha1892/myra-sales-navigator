"use client";

import { useStore } from "@/lib/store";
import { FilterPanel } from "./FilterPanel";
import { ResultsList } from "./ResultsList";
import { SlideOverPane } from "./SlideOverPane";

export function AppShell() {
  const slideOverOpen = useStore((s) => s.slideOverOpen);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar / Filter Panel */}
      <div className="w-[280px] flex-shrink-0 overflow-hidden border-r border-surface-3">
        <FilterPanel />
      </div>

      {/* Main results area */}
      <div className="min-w-0 flex-1">
        <ResultsList />
      </div>

      {/* Slide-over pane */}
      {slideOverOpen && <SlideOverPane />}
    </div>
  );
}
