"use client";

import { useMemo } from "react";
import { DeltaBadge } from "./DeltaBadge";
import type { GtmEntry, GtmV2Segment, CostItem } from "@/lib/gtm/v2-types";
import { SEGMENT_LABELS } from "@/lib/gtm/v2-types";
import { formatUsd } from "@/lib/gtm/format";
import { cn } from "@/lib/cn";

interface ExecutiveDashboardProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

const PIPELINE_ORDER: GtmV2Segment[] = [
  "paying", "prospect", "trial", "post_demo", "demo_queued", "dormant", "lost", "early",
];

const SEGMENT_BAR_COLORS: Record<GtmV2Segment, string> = {
  paying: "bg-emerald-500",
  prospect: "bg-blue-500",
  trial: "bg-purple-500",
  post_demo: "bg-amber-500",
  demo_queued: "bg-orange-400",
  dormant: "bg-gray-400",
  lost: "bg-red-400",
  early: "bg-gray-300",
};

const SEGMENT_BAR_TEXT: Record<GtmV2Segment, string> = {
  paying: "text-white",
  prospect: "text-white",
  trial: "text-white",
  post_demo: "text-white",
  demo_queued: "text-white",
  dormant: "text-white",
  lost: "text-white",
  early: "text-gray-700",
};

export function ExecutiveDashboard({ latest, previous }: ExecutiveDashboardProps) {
  const snap = latest.orgSnapshot;
  const prevSnap = previous?.orgSnapshot;
  const costItems: CostItem[] = snap?.costItems ?? [];

  const kpis = useMemo(() => {
    const paying = snap?.counts?.paying ?? 0;
    const prospects = snap?.counts?.prospect ?? 0;
    const trials = snap?.counts?.trial ?? 0;
    return {
      paying,
      payingPrev: prevSnap?.counts?.paying ?? 0,
      prospects,
      prospectsPrev: prevSnap?.counts?.prospect ?? 0,
      active: paying + prospects + trials,
      activePrev: (prevSnap?.counts?.paying ?? 0) + (prevSnap?.counts?.prospect ?? 0) + (prevSnap?.counts?.trial ?? 0),
    };
  }, [snap, prevSnap]);

  // Pipeline bar segments
  const pipelineSegments = useMemo(() => {
    const total = PIPELINE_ORDER.reduce((s, seg) => s + (snap?.counts?.[seg] ?? 0), 0);
    return PIPELINE_ORDER.map((seg) => ({
      segment: seg,
      count: snap?.counts?.[seg] ?? 0,
      pct: total > 0 ? ((snap?.counts?.[seg] ?? 0) / total) * 100 : 0,
    })).filter((s) => s.count > 0);
  }, [snap]);

  // Top 3 cost orgs
  const topCost = useMemo(
    () => costItems.slice().sort((a, b) => b.costUsd - a.costUsd).slice(0, 3),
    [costItems]
  );
  const maxCost = topCost.length > 0 ? topCost[0].costUsd : 1;

  return (
    <div className="space-y-5">
      {/* Large KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Paying Customers" value={kpis.paying} prev={kpis.payingPrev} color="text-emerald-600" gradient="from-emerald-50 to-emerald-100" />
        <KpiCard label="Strong Prospects" value={kpis.prospects} prev={kpis.prospectsPrev} color="text-blue-600" gradient="from-blue-50 to-blue-100" />
        <KpiCard label="Active Engagement" value={kpis.active} prev={kpis.activePrev} color="text-purple-600" gradient="from-purple-50 to-purple-100" />
      </div>

      {/* Pipeline bar — with labeled segments */}
      <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4">
        <h3 className="text-xs font-semibold text-gray-900 mb-3">Pipeline Distribution</h3>
        <div className="flex h-10 rounded-lg overflow-hidden">
          {pipelineSegments.map((s) => (
            <div
              key={s.segment}
              className={cn(
                "transition-all duration-[180ms] flex items-center justify-center gap-1 overflow-hidden",
                SEGMENT_BAR_COLORS[s.segment],
                SEGMENT_BAR_TEXT[s.segment]
              )}
              style={{ width: `${s.pct}%` }}
              title={`${SEGMENT_LABELS[s.segment]}: ${s.count}`}
            >
              {s.pct > 8 && (
                <span className="text-[10px] font-medium truncate px-1">
                  {SEGMENT_LABELS[s.segment]}
                </span>
              )}
              {s.pct > 5 && (
                <span className="text-[10px] font-semibold font-mono">
                  {s.count}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {pipelineSegments.map((s) => (
            <div key={s.segment} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", SEGMENT_BAR_COLORS[s.segment])} />
              <span className="text-[10px] text-gray-600">{SEGMENT_LABELS[s.segment]}</span>
              <span className="text-[10px] font-mono font-semibold text-gray-900">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4x2 metrics grid */}
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label="Inbound Total" value={latest.inboundTotal} prev={previous?.inboundTotal ?? 0} />
        <MetricTile label="Inbound Active" value={latest.inboundActive} prev={previous?.inboundActive ?? 0} />
        <MetricTile label="Outbound Leads" value={latest.outboundLeads} prev={previous?.outboundLeads ?? 0} />
        <MetricTile label="Outbound Qualified" value={latest.outboundQualified} prev={previous?.outboundQualified ?? 0} />
        <MetricTile label="Total Cost" value={latest.totalCostUsd} prev={previous?.totalCostUsd ?? 0} invert isCost />
        <MetricTile label="Users" value={snap?.totalUsers ?? 0} prev={prevSnap?.totalUsers ?? 0} />
        <MetricTile label="Conversations" value={snap?.totalConversations ?? 0} prev={prevSnap?.totalConversations ?? 0} />
        <MetricTile label="Apollo Contacts" value={latest.apolloContacts} prev={previous?.apolloContacts ?? 0} />
      </div>

      {/* Top Spending — horizontal bars */}
      {topCost.length > 0 && (
        <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-900">Top Spending</h3>
            <span className="text-xs font-mono text-gray-500">{formatUsd(latest.totalCostUsd)} total</span>
          </div>
          <div className="space-y-2">
            {topCost.map((item, i) => {
              const pct = maxCost > 0 ? (item.costUsd / maxCost) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-700 truncate w-[120px] shrink-0 font-medium">
                    {item.name}
                  </span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-700 transition-all duration-[180ms]"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-gray-900 font-semibold shrink-0 w-[72px] text-right">
                    {formatUsd(item.costUsd)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  prev,
  color,
  gradient,
}: {
  label: string;
  value: number;
  prev: number;
  color: string;
  gradient: string;
}) {
  const delta = value - prev;
  const pctChange = prev > 0 ? Math.round((delta / prev) * 100) : 0;

  return (
    <div className={cn("bg-gradient-to-br rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5", gradient)}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <span className={cn("text-4xl font-semibold font-mono tabular-nums block mt-1", color)}>{value}</span>
      <div className="mt-1.5">
        <DeltaBadge current={value} previous={prev} />
      </div>
      {prev > 0 && delta !== 0 && (
        <p className="text-[10px] text-gray-500 mt-1 font-mono">
          {delta > 0 ? "+" : ""}{pctChange}% vs prior
        </p>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  prev,
  invert = false,
  isCost = false,
}: {
  label: string;
  value: number;
  prev: number;
  invert?: boolean;
  isCost?: boolean;
}) {
  return (
    <div className="bg-white/70 rounded-xl border border-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold font-mono tabular-nums text-gray-900">
          {isCost ? formatUsd(value) : value.toLocaleString()}
        </span>
        <DeltaBadge current={value} previous={prev} invert={invert} prefix={isCost ? "$" : undefined} />
      </div>
    </div>
  );
}
