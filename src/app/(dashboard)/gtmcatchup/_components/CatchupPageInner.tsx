"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isGtmAuthed, setGtmAuthed } from "@/lib/gtm-dashboard/auth";
import { PinAuthModal } from "@/components/gtm-dashboard/PinAuthModal";
import {
  useV2Entries,
  useV2EntryByDate,
  useEntryDates,
} from "@/hooks/dashboard/useGtmV2";
import { formatEntryDate } from "@/lib/gtm/v2-utils";
import { KpiStrip } from "@/components/gtm/v2/KpiStrip";
import { PipelineSection } from "@/components/gtm/v2/PipelineSection";
import { LeadGenSection } from "@/components/gtm/v2/LeadGenSection";
import { CostSection } from "@/components/gtm/v2/CostSection";
import { AmDemoSection } from "@/components/gtm/v2/AmDemoSection";
import { AgendaPanel } from "@/components/gtm/v2/AgendaPanel";
import { CompactDashboard } from "@/components/gtm/v2/CompactDashboard";
import { ExecutiveDashboard } from "@/components/gtm/v2/ExecutiveDashboard";
import {
  LayoutSwitcher,
  type DashboardLayout,
} from "@/components/gtm/v2/LayoutSwitcher";
import {
  SkeletonKpi,
  SkeletonSection,
} from "@/components/gtm/v2/SkeletonCards";

function getStoredLayout(): DashboardLayout {
  if (typeof window === "undefined") return "expanded";
  const v = localStorage.getItem("gtm-dashboard-layout");
  if (v === "compact" || v === "executive") return v;
  return "expanded";
}

export default function CatchupPageInner() {
  const [authed, setAuthed] = useState(() => isGtmAuthed());
  const qc = useQueryClient();
  const [layout, setLayout] = useState<DashboardLayout>(() => getStoredLayout());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleLayoutChange = useCallback((l: DashboardLayout) => {
    setLayout(l);
    localStorage.setItem("gtm-dashboard-layout", l);
  }, []);

  // Fetch all entry dates for the date picker
  const { data: allDates = [] } = useEntryDates();

  // Default entries (latest + previous)
  const {
    data: entriesData,
    isLoading: entriesLoading,
    isError: entriesError,
  } = useV2Entries();

  // Fetch selected date's entry (when user picks a historical date)
  const { data: selectedEntry, isLoading: selectedLoading } =
    useV2EntryByDate(selectedDate);

  // Determine which entries to display
  const isHistorical = selectedDate !== null;
  const defaultLatest = entriesData?.latest ?? null;
  const defaultPrevious = entriesData?.previous ?? null;

  // For historical: find the previous entry relative to the selected date
  const latest = isHistorical ? (selectedEntry ?? null) : defaultLatest;
  const previous = (() => {
    if (!isHistorical) return defaultPrevious;
    if (!selectedDate || allDates.length === 0) return null;
    const idx = allDates.indexOf(selectedDate);
    // The date before selectedDate in sorted-desc list is idx+1
    if (idx >= 0 && idx + 1 < allDates.length) {
      // We need the previous entry — fetch it via the entries data if available
      // For now, if selectedDate is the latest, use defaultPrevious
      if (selectedDate === defaultLatest?.entryDate) return defaultPrevious;
    }
    return null;
  })();

  // When latest data loads and no date selected, stay on latest
  const isLoading = entriesLoading || (isHistorical && selectedLoading);

  // Also fetch the previous entry for historical dates
  const prevDateForSelected = (() => {
    if (!isHistorical || !selectedDate || allDates.length === 0) return null;
    const idx = allDates.indexOf(selectedDate);
    if (idx >= 0 && idx + 1 < allDates.length) return allDates[idx + 1];
    return null;
  })();

  const { data: prevEntryForSelected } = useV2EntryByDate(prevDateForSelected);

  // Final previous entry: use fetched previous for historical, or default
  const finalPrevious = isHistorical
    ? (prevEntryForSelected ?? null)
    : defaultPrevious;

  if (!authed) {
    return (
      <PinAuthModal
        onSuccess={() => {
          setGtmAuthed();
          setAuthed(true);
          qc.invalidateQueries({ queryKey: ["gtm-v2"] });
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-[#e8ecf3] via-[#f3eff8] to-[#edf5f2] bg-fixed overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              GTM Catchup
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {latest && (
                <p className="text-xs text-gray-500">
                  {isHistorical ? "Viewing:" : "Last entry:"}{" "}
                  {formatEntryDate(latest.entryDate)}
                  {finalPrevious && (
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
                      Changes since {formatEntryDate(finalPrevious.entryDate)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Date picker */}
            {allDates.length > 1 && (
              <select
                value={selectedDate ?? ""}
                onChange={(e) =>
                  setSelectedDate(e.target.value || null)
                }
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
              >
                <option value="">Latest</option>
                {allDates.map((d) => (
                  <option key={d} value={d}>
                    {formatEntryDate(d)}
                  </option>
                ))}
              </select>
            )}

            {/* Layout switcher */}
            <LayoutSwitcher value={layout} onChange={handleLayoutChange} />

            <a
              href="/gtmcatchup/entry"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Edit Data
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto px-6 py-4 flex flex-col">
        {entriesError ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-2">
              Failed to load data. Try refreshing.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Refresh page
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <SkeletonKpi />
            <SkeletonSection rows={5} />
            <SkeletonSection rows={3} />
          </div>
        ) : !latest ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-4">
              No entries yet. Create your first entry to see the dashboard.
            </p>
            <a
              href="/gtmcatchup/entry"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors inline-block"
            >
              Create First Entry
            </a>
          </div>
        ) : layout === "compact" ? (
          <CompactDashboard latest={latest} previous={finalPrevious} />
        ) : layout === "executive" ? (
          <ExecutiveDashboard latest={latest} previous={finalPrevious} />
        ) : (
          <>
            {/* Expanded (default) layout — 2-column like old dashboard */}
            <KpiStrip latest={latest} previous={finalPrevious} />
            <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr] gap-4 mt-4">
              {/* Left column: Pipeline + Lead Gen */}
              <div className="flex flex-col gap-4 overflow-auto">
                <PipelineSection latest={latest} previous={finalPrevious} />
                <LeadGenSection latest={latest} previous={finalPrevious} />
                <AmDemoSection latest={latest} />
              </div>
              {/* Right column: Cost table (fills height) */}
              <div className="flex flex-col gap-4 overflow-auto">
                <CostSection latest={latest} previous={finalPrevious} />
                <AgendaPanel latest={latest} previous={finalPrevious} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
