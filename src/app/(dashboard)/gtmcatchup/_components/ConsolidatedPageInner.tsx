"use client";

import { useState, useMemo, type ReactNode } from "react";
import { isGtmAuthed, setGtmAuthed } from "@/lib/gtm-dashboard/auth";
import { PinAuthModal } from "@/components/gtm-dashboard/PinAuthModal";
import {
  useEntryDates,
  useEntriesByDates,
  useLatestAmPerformance,
  useUnresolvedAgenda,
} from "@/hooks/dashboard/useGtmV2";
import { cn } from "@/lib/cn";
import { formatEntryDate } from "@/lib/gtm/v2-utils";
import { ConsolidatedSummary } from "@/components/gtm/v2/consolidated/SummaryTab";
import { ConsolidatedPipeline } from "@/components/gtm/v2/consolidated/PipelineTab";
import { ConsolidatedCost } from "@/components/gtm/v2/consolidated/CostTab";
import { ConsolidatedMovements } from "@/components/gtm/v2/consolidated/MovementsTab";
import { ConsolidatedAgenda } from "@/components/gtm/v2/consolidated/AgendaTab";
import { ConsolidatedAmPerformance } from "@/components/gtm/v2/consolidated/AmPerformanceTab";
import type { GtmEntry, AmPerformanceReport, GtmAgendaItem } from "@/lib/gtm/v2-types";
import { CHECKPOINT_PILL_COLORS } from "@/lib/gtm/v2-types";

type TabKey = "summary" | "am" | "pipeline" | "cost" | "movements" | "agenda";

interface ConsolidatedTab {
  key: TabKey;
  label: string;
  enabled: boolean;
}

const TABS: ConsolidatedTab[] = [
  { key: "summary", label: "Summary", enabled: true },
  { key: "am", label: "AM Performance", enabled: true },
  { key: "pipeline", label: "Pipeline", enabled: true },
  { key: "cost", label: "Cost Economics", enabled: true },
  { key: "movements", label: "Movements", enabled: true },
  { key: "agenda", label: "Agenda", enabled: true },
];

interface TabProps {
  entries: GtmEntry[];
  amReport: AmPerformanceReport | null;
  agendaItems: GtmAgendaItem[];
}

const TAB_RENDERERS: Record<TabKey, (p: TabProps) => ReactNode> = {
  summary: (p) => <ConsolidatedSummary entries={p.entries} />,
  am: (p) => <ConsolidatedAmPerformance report={p.amReport} />,
  pipeline: (p) => <ConsolidatedPipeline entries={p.entries} />,
  cost: (p) => <ConsolidatedCost entries={p.entries} />,
  movements: (p) => <ConsolidatedMovements entries={p.entries} />,
  agenda: (p) => <ConsolidatedAgenda entries={p.entries} agendaItems={p.agendaItems} />,
};

export default function ConsolidatedPageInner() {
  const [authed, setAuthed] = useState(() => isGtmAuthed());
  const [tab, setTab] = useState<TabKey>("summary");
  const [checkpointCount, setCheckpointCount] = useState(3);
  const [customDates, setCustomDates] = useState<string[] | null>(null);

  // Fetch all available dates
  const { data: allDates = [], isLoading: datesLoading, isError: datesError, error: datesErrorObj } = useEntryDates(authed);

  // Determine which dates to use as checkpoints
  const checkpointDates = useMemo(() => {
    if (customDates && customDates.length > 0) return customDates.sort();
    // Default: pick evenly spaced dates from allDates (desc order)
    if (allDates.length === 0) return [];
    if (allDates.length <= checkpointCount) return [...allDates].reverse();
    // Pick first, last, and evenly spaced middle dates
    const sorted = [...allDates].reverse(); // now ascending
    const step = (sorted.length - 1) / (checkpointCount - 1);
    const picked: string[] = [];
    for (let i = 0; i < checkpointCount; i++) {
      picked.push(sorted[Math.round(i * step)]);
    }
    return picked;
  }, [allDates, checkpointCount, customDates]);

  // Fetch entries for selected checkpoints
  const { data: entries = [], isLoading: entriesLoading, isError: entriesError, error: entriesErrorObj } = useEntriesByDates(
    checkpointDates,
    authed && checkpointDates.length > 0
  );

  // Fetch latest AM performance (lazy: only when AM tab active)
  const { data: amReport } = useLatestAmPerformance(authed && tab === "am");

  // Fetch unresolved agenda items (lazy: only when agenda tab active)
  const { data: agendaItems = [] } = useUnresolvedAgenda(authed && tab === "agenda");

  if (!authed) {
    return (
      <PinAuthModal
        onSuccess={() => {
          setGtmAuthed();
          setAuthed(true);
        }}
      />
    );
  }

  const isLoading = datesLoading || entriesLoading;
  const isError = datesError || entriesError;
  const errorMessage = datesError
    ? (datesErrorObj instanceof Error ? datesErrorObj.message : "Failed to load dates")
    : (entriesErrorObj instanceof Error ? entriesErrorObj.message : "Failed to load entries");
  const enabledTabs = TABS.filter((t) => t.enabled);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-[#e8ecf3] via-[#f3eff8] to-[#edf5f2] bg-fixed overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <a
                  href="/gtmcatchup"
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  &larr; Dashboard
                </a>
                <h1 className="text-lg font-semibold text-gray-900">
                  GTM Consolidated View
                </h1>
              </div>
              {entries.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatEntryDate(entries[0].entryDate)} – {formatEntryDate(entries[entries.length - 1].entryDate)}
                  <span className="ml-2 text-gray-400">{entries.length} checkpoints</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Checkpoint count */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider">Checkpoints</label>
                <select
                  value={customDates ? "custom" : checkpointCount}
                  onChange={(e) => {
                    if (e.target.value === "custom") return;
                    setCustomDates(null);
                    setCheckpointCount(Number(e.target.value));
                  }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={7}>7</option>
                  <option value={10}>10</option>
                  {allDates.length > 10 && (
                    <option value={allDates.length}>All ({allDates.length})</option>
                  )}
                </select>
              </div>
              {/* Date multi-select toggle */}
              <CheckpointPicker
                allDates={allDates}
                selectedDates={checkpointDates}
                onSelect={(dates) => {
                  setCustomDates(dates);
                  setCheckpointCount(dates.length);
                }}
              />
              <a
                href="/gtmcatchup/am-performance"
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit AM Data
              </a>
            </div>
          </div>

          {/* Checkpoint pills */}
          {entries.length > 0 && (
            <div className="flex gap-1.5 mt-3">
              {entries.map((entry, i) => (
                <span
                  key={entry.entryDate}
                  className={cn(
                    "text-[10px] font-mono font-medium px-2.5 py-1 rounded-md border",
                    CHECKPOINT_PILL_COLORS[i % CHECKPOINT_PILL_COLORS.length]
                  )}
                >
                  {formatEntryDate(entry.entryDate)}
                </span>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0 mt-3 -mb-px">
            {enabledTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                  tab === key
                    ? "text-gray-900 border-gray-900"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-6 py-4 overflow-auto">
        {isError ? (
          <div className="text-center py-16">
            <p className="text-sm text-red-600 mb-2">Something went wrong</p>
            <p className="text-xs text-gray-500 mb-4">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-white/50 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-4">No entries found. Create entries to see consolidated data.</p>
            <a
              href="/gtmcatchup/entry"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors inline-block"
            >
              Create Entry
            </a>
          </div>
        ) : (
          <>{TAB_RENDERERS[tab]?.({ entries, amReport: amReport ?? null, agendaItems })}</>
        )}
      </div>
    </div>
  );
}

/** Small dropdown to pick specific dates */
function CheckpointPicker({
  allDates,
  selectedDates,
  onSelect,
}: {
  allDates: string[];
  selectedDates: string[];
  onSelect: (dates: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(selectedDates);

  if (allDates.length <= 3) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
      >
        Pick dates
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-h-64 overflow-y-auto w-48">
            {allDates.map((d) => (
              <label key={d} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1 rounded">
                <input
                  type="checkbox"
                  checked={selected.has(d)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(d);
                    else {
                      next.delete(d);
                      if (next.size === 0) return;
                    }
                    onSelect([...next].sort());
                  }}
                  className="rounded border-gray-300"
                />
                <span className="text-xs font-mono text-gray-700">{formatEntryDate(d)}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
