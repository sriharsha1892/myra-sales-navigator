"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { isGtmAuthed, setGtmAuthed } from "@/lib/gtm-dashboard/auth";
import { PinAuthModal } from "@/components/gtm-dashboard/PinAuthModal";
import { useV2Entries, useV2EntryByDate, useSaveEntry } from "@/hooks/dashboard/useGtmV2";
import { cn } from "@/lib/cn";
import { OrgsTab } from "@/components/gtm/v2/OrgsTab";
import { LeadGenTab } from "@/components/gtm/v2/LeadGenTab";
import { CostsTab } from "@/components/gtm/v2/CostsTab";
import { AmDemosTab } from "@/components/gtm/v2/AmDemosTab";
import { AgendaTab } from "@/components/gtm/v2/AgendaTab";
import { GtmToastProvider, useGtmToast } from "@/components/gtm/v2/Toast";
import type { OrgSnapshot, GtmV2Segment, CostItem } from "@/lib/gtm/v2-types";
import { ALL_V2_SEGMENTS } from "@/lib/gtm/v2-types";
import { buildSnapshotFromEdits } from "@/lib/gtm/v2-utils";

type Tab = "orgs" | "leadgen" | "costs" | "demos" | "agenda";

const TABS: { key: Tab; label: string }[] = [
  { key: "orgs", label: "Orgs" },
  { key: "leadgen", label: "Lead Gen" },
  { key: "costs", label: "Costs" },
  { key: "demos", label: "AM Demos" },
  { key: "agenda", label: "Agenda" },
];

function todayDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function emptySnapshot(): OrgSnapshot {
  const counts = {} as Record<GtmV2Segment, number>;
  const names = {} as Record<GtmV2Segment, string[]>;
  for (const seg of ALL_V2_SEGMENTS) {
    counts[seg] = 0;
    names[seg] = [];
  }
  return { counts, names, totalCost: 0, totalUsers: 0, totalConversations: 0, costItems: [] };
}

function EntryPageContent() {
  const [authed, setAuthed] = useState(() => isGtmAuthed());

  const [tab, setTab] = useState<Tab>("orgs");
  const [entryDate, setEntryDate] = useState(todayDate);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { addToast } = useGtmToast();

  const { data: entriesData, isLoading: entriesLoading } = useV2Entries(authed);
  const { data: dateEntry, isLoading: dateEntryLoading } = useV2EntryByDate(entryDate);
  const saveEntry = useSaveEntry();

  const latest = entriesData?.latest ?? null;
  const previous = entriesData?.previous ?? null;

  // Snapshot state (replaces dirty org tracking)
  const [snapshot, setSnapshot] = useState<OrgSnapshot>(emptySnapshot);
  const [costPeriod, setCostPeriod] = useState("");

  // Form state
  const [leadGen, setLeadGen] = useState({
    inboundTotal: 0,
    inboundActive: 0,
    inboundJunk: 0,
    outboundLeads: 0,
    outboundReached: 0,
    outboundFollowed: 0,
    outboundQualified: 0,
    apolloContacts: 0,
    apolloNote: "",
  });

  const [amDemos, setAmDemos] = useState<Record<string, number>>({});

  // Track whether form has been touched
  const isDirty = useRef(false);
  const synced = useRef<string | null>(null);

  // Sync form when dateEntry loads or changes
  useEffect(() => {
    const source = dateEntry ?? latest;
    if (!source) return;

    const key = `${source.id}-${entryDate}`;
    if (synced.current === key) return;
    synced.current = key;

    setLeadGen({
      inboundTotal: source.inboundTotal,
      inboundActive: source.inboundActive,
      inboundJunk: source.inboundJunk,
      outboundLeads: source.outboundLeads,
      outboundReached: source.outboundReached,
      outboundFollowed: source.outboundFollowed,
      outboundQualified: source.outboundQualified,
      apolloContacts: source.apolloContacts,
      apolloNote: source.apolloNote ?? "",
    });
    setCostPeriod(source.costPeriod ?? "");
    setAmDemos(source.amDemos ?? {});

    // Sync snapshot (carry forward from source)
    const snap = source.orgSnapshot ?? emptySnapshot();
    setSnapshot({
      ...snap,
      // Ensure all segments exist
      counts: { ...emptySnapshot().counts, ...snap.counts },
      names: { ...emptySnapshot().names, ...snap.names },
      costItems: snap.costItems ?? [],
    });

    isDirty.current = false;
  }, [dateEntry, latest, entryDate]);

  // Reset sync key when date changes so we re-sync
  useEffect(() => {
    synced.current = null;
  }, [entryDate]);

  // Unsaved changes warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleSnapshotChange = useCallback((newSnapshot: OrgSnapshot) => {
    isDirty.current = true;
    setSnapshot(newSnapshot);
  }, []);

  const handleCostItemsChange = useCallback(
    (items: CostItem[]) => {
      isDirty.current = true;
      // Rebuild snapshot with new cost items
      setSnapshot((prev) => buildSnapshotFromEdits(prev.names, items));
    },
    []
  );

  const handleCostPeriodChange = useCallback((period: string) => {
    isDirty.current = true;
    setCostPeriod(period);
  }, []);

  const handleLeadGenChange = useCallback(
    (field: string, value: number | string) => {
      isDirty.current = true;
      setLeadGen((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleDemosChange = useCallback((v: Record<string, number>) => {
    isDirty.current = true;
    setAmDemos(v);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build final snapshot from current names + costItems
      const finalSnapshot = buildSnapshotFromEdits(
        snapshot.names,
        snapshot.costItems ?? []
      );

      await saveEntry.mutateAsync({
        entryDate,
        ...leadGen,
        totalCostUsd: finalSnapshot.totalCost,
        costPeriod: costPeriod || undefined,
        amDemos,
        orgSnapshot: finalSnapshot,
      });
      isDirty.current = false;
      setSaveSuccess(true);
      addToast("Entry saved", "success");
      setTimeout(() => setSaveSuccess(false), 1500);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8ecf3] via-[#f3eff8] to-[#edf5f2]">
      {/* Header */}
      <div className="border-b border-gray-200/50 bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/gtmcatchup"
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                &larr; Dashboard
              </a>
              <h1 className="text-lg font-semibold text-gray-900">
                GTM Data Entry
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={entryDate}
                max={todayDate()}
                onChange={(e) => setEntryDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              {entryDate !== todayDate() && (
                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Historical entry
                </span>
              )}
              {dateEntry && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  Existing entry
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-lg transition-colors",
                  saveSuccess
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
                )}
              >
                {saving ? "Saving..." : saveSuccess ? "\u2713 Saved" : "Save Entry"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                  tab === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6">
          {dateEntryLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Loading entry for {entryDate}...
            </div>
          ) : (entriesLoading && !entriesData && !dateEntry) ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
              ))}
              <p className="text-xs text-gray-400 text-center">Loading...</p>
            </div>
          ) : (<>
          {tab === "orgs" && (
            <OrgsTab
              snapshot={snapshot}
              onSnapshotChange={handleSnapshotChange}
            />
          )}
          {tab === "leadgen" && (
            <LeadGenTab
              values={leadGen}
              onChange={handleLeadGenChange}
              previous={previous}
            />
          )}
          {tab === "costs" && (
            <CostsTab
              costItems={snapshot.costItems ?? []}
              onCostItemsChange={handleCostItemsChange}
              costPeriod={costPeriod}
              onCostPeriodChange={handleCostPeriodChange}
            />
          )}
          {tab === "demos" && (
            <AmDemosTab values={amDemos} onChange={handleDemosChange} />
          )}
          {tab === "agenda" && (
            <AgendaTab
              entryDate={entryDate}
              currentEntry={dateEntry ?? latest}
              previousEntry={previous}
            />
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}

export default function EntryPageInner() {
  return (
    <GtmToastProvider>
      <EntryPageContent />
    </GtmToastProvider>
  );
}
