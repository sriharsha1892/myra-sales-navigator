"use client";

import { useMemo, useState } from "react";
import { DeltaBadge } from "./DeltaBadge";
import { HoverTooltip } from "@/components/gtm-dashboard/HoverTooltip";
import { useAgendaItems } from "@/hooks/dashboard/useGtmV2";
import type { GtmEntry, GtmV2Segment, CostItem } from "@/lib/gtm/v2-types";
import { SEGMENT_LABELS, AGENDA_SECTIONS } from "@/lib/gtm/v2-types";
import { buildDeltaSummary } from "@/lib/gtm/v2-utils";
import { cn } from "@/lib/cn";

interface CompactDashboardProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

const PIPELINE_SEGMENTS: GtmV2Segment[] = [
  "paying", "prospect", "trial", "post_demo", "demo_queued", "dormant", "lost", "early",
];

export function CompactDashboard({ latest, previous }: CompactDashboardProps) {
  const snap = latest.orgSnapshot;
  const prevSnap = previous?.orgSnapshot;
  const costItems: CostItem[] = snap?.costItems ?? [];
  const topCostItems = useMemo(
    () => costItems.slice().sort((a, b) => b.costUsd - a.costUsd).slice(0, 5),
    [costItems]
  );

  const demos = latest.amDemos ?? {};
  const demoEntries = Object.entries(demos).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);

  const { data: agendaItems = [] } = useAgendaItems(latest.entryDate);
  const deltaSummary = previous ? buildDeltaSummary(latest, previous) : null;

  // KPI strip (inline, compact)
  const kpis = useMemo(() => {
    const paying = snap?.counts?.paying ?? 0;
    const prospects = snap?.counts?.prospect ?? 0;
    const trials = snap?.counts?.trial ?? 0;
    return [
      { label: "Paying", value: paying, prev: prevSnap?.counts?.paying ?? 0, color: "text-emerald-600" },
      { label: "Prospects", value: prospects, prev: prevSnap?.counts?.prospect ?? 0, color: "text-blue-600" },
      { label: "Active", value: paying + prospects + trials, prev: (prevSnap?.counts?.paying ?? 0) + (prevSnap?.counts?.prospect ?? 0) + (prevSnap?.counts?.trial ?? 0), color: "text-purple-600" },
    ];
  }, [snap, prevSnap]);

  return (
    <div className="space-y-4">
      {/* KPI Strip — compact horizontal */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white/70 rounded-xl border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] px-4 py-3">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{k.label}</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={cn("text-2xl font-semibold font-mono tabular-nums", k.color)}>{k.value}</span>
              <DeltaBadge current={k.value} previous={k.prev} />
            </div>
          </div>
        ))}
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* LEFT: Pipeline + Lead Gen */}
        <div className="space-y-4">
          {/* Pipeline */}
          <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4">
            <h3 className="text-xs font-semibold text-gray-900 mb-3">Pipeline</h3>
            <div className="space-y-1">
              {PIPELINE_SEGMENTS.map((seg) => {
                const count = snap?.counts?.[seg] ?? 0;
                const prev = prevSnap?.counts?.[seg] ?? 0;
                if (count === 0 && prev === 0) return null;
                return (
                  <HoverTooltip
                    key={seg}
                    content={(snap?.names?.[seg] ?? []).join("\n") || "None"}
                  >
                    <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50/80 transition-colors cursor-default">
                      <span className="text-xs text-gray-600">{SEGMENT_LABELS[seg]}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900 font-mono tabular-nums">{count}</span>
                        <DeltaBadge current={count} previous={prev} />
                      </div>
                    </div>
                  </HoverTooltip>
                );
              })}
            </div>
          </div>

          {/* Lead Gen */}
          <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4">
            <h3 className="text-xs font-semibold text-gray-900 mb-3">Lead Gen</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Inbound", value: latest.inboundTotal, prev: previous?.inboundTotal ?? 0 },
                { label: "Active", value: latest.inboundActive, prev: previous?.inboundActive ?? 0 },
                { label: "Junk", value: latest.inboundJunk, prev: previous?.inboundJunk ?? 0, invert: true },
              ].map((m) => (
                <div key={m.label} className="p-2 bg-gray-50 rounded-lg text-center">
                  <p className="text-[9px] text-gray-500 uppercase">{m.label}</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono tabular-nums">{m.value}</p>
                  <DeltaBadge current={m.value} previous={m.prev} invert={m.invert} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              {[
                { label: "Leads", value: latest.outboundLeads, prev: previous?.outboundLeads ?? 0 },
                { label: "Reached", value: latest.outboundReached, prev: previous?.outboundReached ?? 0 },
                { label: "Followed", value: latest.outboundFollowed, prev: previous?.outboundFollowed ?? 0 },
                { label: "Qualified", value: latest.outboundQualified, prev: previous?.outboundQualified ?? 0 },
              ].map((s, i, arr) => (
                <div key={s.label} className="flex items-center gap-1.5 flex-1">
                  <div className="flex-1 text-center p-1.5 bg-gray-50 rounded">
                    <p className="text-gray-500 uppercase">{s.label}</p>
                    <p className="text-sm font-semibold text-gray-900 font-mono tabular-nums">{s.value}</p>
                  </div>
                  {i < arr.length - 1 && <span className="text-gray-300">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Cost + Top 5 + Demos */}
        <div className="space-y-4">
          {/* Cost banner */}
          <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl text-white">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
              Total Cost{latest.costPeriod ? ` — ${latest.costPeriod}` : ""}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold font-mono tabular-nums">
                ${latest.totalCostUsd.toLocaleString()}
              </span>
              {previous && <DeltaBadge current={latest.totalCostUsd} previous={previous.totalCostUsd} invert />}
            </div>
          </div>

          {/* Top 5 cost items */}
          {topCostItems.length > 0 && (
            <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Top Cost Items</h3>
              <div className="space-y-1">
                {topCostItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-700 truncate mr-2">{item.name}</span>
                    <span className="font-mono tabular-nums text-gray-900 font-medium">${item.costUsd.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demos */}
          {demoEntries.length > 0 && (
            <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">AM Demos</h3>
              <div className="grid grid-cols-2 gap-2">
                {demoEntries.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-xs py-1 px-2 bg-gray-50 rounded">
                    <span className="text-gray-700">{name}</span>
                    <span className="font-mono tabular-nums font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agenda — collapsed row */}
      {(agendaItems.length > 0 || deltaSummary) && (
        <AgendaCompact items={agendaItems} deltaSummary={deltaSummary} />
      )}
    </div>
  );
}

function AgendaCompact({
  items,
  deltaSummary,
}: {
  items: { id: string; section: string; content: string; isResolved: boolean }[];
  deltaSummary: string | null;
}) {
  const openCount = items.filter((i) => !i.isResolved).length;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-900">Agenda</h3>
          {openCount > 0 && (
            <span className="text-[10px] text-gray-400 font-mono">{openCount} open</span>
          )}
        </div>
        <svg
          className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-[180ms]", expanded && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {deltaSummary && (
            <p className="text-[11px] font-medium text-blue-700 bg-blue-50 rounded px-2 py-1">{deltaSummary}</p>
          )}
          {AGENDA_SECTIONS.map(({ key, label }) => {
            const sectionItems = items.filter((i) => i.section === key);
            if (sectionItems.length === 0) return null;
            return (
              <div key={key}>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <ul className="space-y-0.5">
                  {sectionItems.map((item) => (
                    <li key={item.id} className={cn("text-[11px] pl-2.5 relative", item.isResolved ? "text-gray-400 line-through" : "text-gray-700")}>
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-gray-400" />
                      {item.content}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

