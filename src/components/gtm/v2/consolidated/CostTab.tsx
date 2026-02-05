"use client";

import { useState, useMemo } from "react";
import type { GtmEntry, GtmV2Segment, CostItem } from "@/lib/gtm/v2-types";
import { CHECKPOINT_COLORS } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/gtm/format";

type Filter = "all" | "paying" | "prospect" | "trial";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  paying: "Paying",
  prospect: "Prospects",
  trial: "Trials",
};

interface Props {
  entries: GtmEntry[];
}

export function ConsolidatedCost({ entries }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  // Declare derived values unconditionally (hooks must not follow early returns)
  const prev = entries.length >= 2 ? entries[entries.length - 2] : null;
  const latest = entries.length >= 2 ? entries[entries.length - 1] : null;

  const segmentCosts = useMemo(() => {
    if (!latest || !prev) return [];
    const segs: { key: "paying" | "prospect" | "trial"; label: string; color: string }[] = [
      { key: "paying", label: "Paying", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
      { key: "prospect", label: "Prospects", color: "border-blue-200 bg-blue-50 text-blue-700" },
      { key: "trial", label: "Trials", color: "border-purple-200 bg-purple-50 text-purple-700" },
    ];
    return segs.map(({ key, label, color }) => {
      const names = new Set(latest.orgSnapshot?.names?.[key] ?? []);
      const latestItems = (latest.orgSnapshot?.costItems ?? []).filter((it) => names.has(it.name));
      const prevNames = new Set(prev.orgSnapshot?.names?.[key] ?? []);
      const prevItems = (prev.orgSnapshot?.costItems ?? []).filter((it) => prevNames.has(it.name));
      return {
        key,
        label,
        color,
        latestTotal: latestItems.reduce((s, it) => s + it.costUsd, 0),
        prevTotal: prevItems.reduce((s, it) => s + it.costUsd, 0),
        latestDate: latest.entryDate,
        prevDate: prev.entryDate,
      };
    });
  }, [latest, prev]);

  const orgRows = useMemo(() => {
    if (!latest || !prev) return [];
    const latestNames = new Set<string>();
    const prevMap = new Map<string, CostItem>();
    const latestMap = new Map<string, CostItem>();

    const nameToSeg = new Map<string, GtmV2Segment>();
    const snap = latest.orgSnapshot;
    if (snap?.names) {
      for (const [seg, names] of Object.entries(snap.names)) {
        for (const n of names) nameToSeg.set(n, seg as GtmV2Segment);
      }
    }

    for (const it of (latest.orgSnapshot?.costItems ?? [])) {
      latestMap.set(it.name, it);
      latestNames.add(it.name);
    }
    for (const it of (prev.orgSnapshot?.costItems ?? [])) {
      prevMap.set(it.name, it);
      latestNames.add(it.name);
    }

    return [...latestNames]
      .map((name) => {
        const l = latestMap.get(name);
        const p = prevMap.get(name);
        return {
          name,
          segment: nameToSeg.get(name) ?? ("trial" as GtmV2Segment),
          prevCost: p?.costUsd ?? null,
          latestCost: l?.costUsd ?? null,
          prevConvos: p?.conversations ?? null,
          latestConvos: l?.conversations ?? null,
          users: l?.users ?? p?.users ?? 0,
        };
      })
      .filter((r) => {
        if (filter === "all") return true;
        return r.segment === filter;
      })
      .sort((a, b) => (b.latestCost ?? 0) - (a.latestCost ?? 0));
  }, [latest, prev, filter]);

  if (entries.length < 2 || !prev || !latest) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-sm text-gray-500">Need at least 2 checkpoints for cost comparison.</p>
      </div>
    );
  }

  // Grand totals per checkpoint
  const grandCards = entries.map((e) => ({
    date: e.entryDate,
    total: e.totalCostUsd,
    orgCount: e.orgSnapshot?.costItems?.length ?? 0,
  }));

  const segBadge: Record<string, string> = {
    paying: "text-emerald-700 bg-emerald-50",
    prospect: "text-blue-700 bg-blue-50",
    trial: "text-purple-700 bg-purple-50",
  };

  return (
    <div className="space-y-5">
      {/* Grand totals */}
      <div className={cn("grid gap-3.5", entries.length === 2 ? "grid-cols-2" : entries.length === 3 ? "grid-cols-3" : "grid-cols-4")}>
        {grandCards.map((c, i) => (
          <div key={c.date} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm text-center">
            <div className="text-[10px] font-mono text-gray-500 mb-1">{shortDate(c.date)}</div>
            <div className={cn("font-mono text-2xl font-semibold", CHECKPOINT_COLORS[i % CHECKPOINT_COLORS.length])}>
              {c.total.toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">{c.orgCount} orgs tracked</div>
          </div>
        ))}
      </div>

      {/* Segment summary */}
      <div className="grid grid-cols-3 gap-3.5">
        {segmentCosts.map((s) => (
          <div key={s.key} className={cn("rounded-xl border p-4", s.color)}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2">{s.label}</div>
            <div className="flex items-baseline gap-2">
              <div className="flex flex-col items-center flex-1">
                <span className="font-mono text-lg font-semibold text-gray-900">{s.prevTotal.toLocaleString()}</span>
                <span className="text-[9px] text-gray-400 font-mono">{shortDate(s.prevDate)}</span>
              </div>
              <span className="text-gray-300">&rarr;</span>
              <div className="flex flex-col items-center flex-1">
                <span className="font-mono text-lg font-semibold text-gray-900">{s.latestTotal.toLocaleString()}</span>
                <span className="text-[9px] text-gray-400 font-mono">{shortDate(s.latestDate)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-org table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              Per-Organization Comparison{" "}
              <span className="font-normal text-gray-500 text-xs">
                {shortDate(prev.entryDate)} vs {shortDate(latest.entryDate)}
              </span>
            </div>
            <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden">
              {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors border-r border-gray-200 last:border-r-0",
                    filter === f
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">Organization</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">{shortDate(prev.entryDate)}</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">{shortDate(latest.entryDate)}</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">&Delta; Cost</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">Users</th>
              </tr>
            </thead>
            <tbody>
              {orgRows.map((r) => {
                const delta = r.prevCost !== null && r.latestCost !== null
                  ? r.latestCost - r.prevCost
                  : null;
                return (
                  <tr key={r.name} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {r.name}
                      <span className={cn("ml-2 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded", segBadge[r.segment] ?? "text-gray-400 bg-gray-50")}>
                        {(r.segment === "paying" ? "Pay" : r.segment === "prospect" ? "Pro" : "Tri")}
                      </span>
                    </td>
                    <td className={cn("px-3 py-2.5 text-right font-mono tabular-nums", r.prevCost === null && "text-gray-300")}>
                      {r.prevCost !== null ? r.prevCost.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {r.latestCost !== null ? r.latestCost.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {delta === null ? (
                        <span className="text-amber-600 text-xs font-semibold">new</span>
                      ) : delta === 0 ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span className={cn("font-semibold", delta > 0 ? "text-emerald-700" : "text-red-600")}>
                          {delta > 0 ? "+" : ""}{delta.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-gray-600">{r.users}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
