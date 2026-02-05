"use client";

import { useState } from "react";
import type { AmPerformanceReport, AmChannelBreakdown } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";

interface Props {
  report: AmPerformanceReport | null;
}

type SubTab = "funnel" | "channels";

const CH_COLORS: Record<keyof AmChannelBreakdown, string> = {
  email: "bg-blue-600",
  calls: "bg-emerald-600",
  linkedin: "bg-purple-600",
  waOther: "bg-amber-500",
};

const CH_LABELS: Record<keyof AmChannelBreakdown, string> = {
  email: "Email",
  calls: "Calls",
  linkedin: "LinkedIn",
  waOther: "WA / Other",
};

export function ConsolidatedAmPerformance({ report }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("funnel");

  if (!report) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500 mb-4">
          No AM performance data yet.
        </p>
        <a
          href="/gtmcatchup/am-performance"
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors inline-block"
        >
          Add AM Performance Data
        </a>
      </div>
    );
  }

  const rows = report.amData ?? [];
  const activeRows = rows.filter((r) => r.status === "active");
  const totalOutreach = rows.reduce((s, r) => s + r.outreach, 0);
  const totalDemos = rows.reduce((s, r) => s + r.demos, 0);
  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const weeks = Math.max(
    1,
    Math.ceil(
      (new Date(report.periodEnd).getTime() - new Date(report.periodStart).getTime()) /
        (7 * 86400000)
    )
  );

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3.5">
        <KpiCard label="Total Demos" value={totalDemos} sub={`${activeRows.length} AMs · ${weeks} wks`} />
        <KpiCard label="Trackable Outreach" value={totalOutreach} sub={`${activeRows.length} AMs reporting`} />
        <KpiCard
          label="Blended Conv. Rate"
          value={totalOutreach > 0 ? ((totalDemos / totalOutreach) * 100).toFixed(1) + "%" : "—"}
          sub={`${totalDemos} demos / ${totalOutreach.toLocaleString()} outreach`}
        />
        <KpiCard label="Closed Sales" value={totalSales} sub={`${rows.length} AMs`} />
      </div>

      {/* Sub-tab toggle */}
      <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden w-fit">
        {(["funnel", "channels"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={cn(
              "px-4 py-2 text-xs font-medium transition-colors border-r border-gray-200 last:border-r-0",
              subTab === t
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            )}
          >
            {t === "funnel" ? "Funnel" : "Channels"}
          </button>
        ))}
      </div>

      {subTab === "funnel" ? (
        <FunnelView rows={rows} />
      ) : (
        <ChannelsView rows={rows} />
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      <div className="font-mono text-2xl font-semibold text-gray-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[11px] text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

function FunnelView({ rows }: { rows: AmPerformanceReport["amData"] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80">
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Account Manager</th>
              <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Outreach</th>
              <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Demos</th>
              <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">OR&rarr;D</th>
              <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sales</th>
              <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">D&rarr;S</th>
              <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const orD = row.outreach > 0 ? ((row.demos / row.outreach) * 100).toFixed(1) + "%" : "—";
              const dS = row.demos > 0 ? ((row.sales / row.demos) * 100).toFixed(1) + "%" : "—";
              return (
                <tr
                  key={row.name}
                  className={cn(
                    "border-t border-gray-100 hover:bg-gray-50/50",
                    row.status === "inactive" && "opacity-55"
                  )}
                >
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                    {row.name}
                    {row.status === "inactive" && (
                      <span className="ml-2 text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {row.outreach > 0 ? row.outreach.toLocaleString() : <span className="text-gray-300">&ndash;</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">{row.demos}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-gray-500">{orD}</td>
                  <td className={cn(
                    "px-3 py-3 text-right font-mono tabular-nums font-semibold",
                    row.sales === 0 && "text-red-500"
                  )}>
                    {row.sales}
                  </td>
                  <td className={cn(
                    "px-3 py-3 text-right font-mono tabular-nums",
                    row.demos > 0 && row.sales > 0 && (row.sales / row.demos) > 0.08 ? "text-emerald-700 font-semibold" : "text-gray-500"
                  )}>
                    {dS}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 max-w-xs truncate">{row.note}</td>
                </tr>
              );
            })}
            {/* Totals */}
            <tr className="border-t-2 border-gray-300 bg-gray-50/80 font-semibold">
              <td className="px-4 py-3 text-gray-900">Total ({rows.length} AMs)</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{rows.reduce((s, r) => s + r.outreach, 0).toLocaleString()}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{rows.reduce((s, r) => s + r.demos, 0)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums text-gray-500">
                {(() => { const o = rows.reduce((s, r) => s + r.outreach, 0); const d = rows.reduce((s, r) => s + r.demos, 0); return o > 0 ? ((d / o) * 100).toFixed(1) + "%" : "—"; })()}
              </td>
              <td className="px-3 py-3 text-right font-mono tabular-nums">{rows.reduce((s, r) => s + r.sales, 0)}</td>
              <td className="px-3 py-3 text-right font-mono tabular-nums text-gray-500">
                {(() => { const d = rows.reduce((s, r) => s + r.demos, 0); const sl = rows.reduce((s, r) => s + r.sales, 0); return d > 0 ? ((sl / d) * 100).toFixed(1) + "%" : "—"; })()}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChannelsView({ rows }: { rows: AmPerformanceReport["amData"] }) {
  const channels: (keyof AmChannelBreakdown)[] = ["email", "calls", "linkedin", "waOther"];
  const hasAnyChannels = rows.some((r) => r.demoChannels || r.outreachChannels);

  if (!hasAnyChannels) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-sm text-gray-500">No channel data available. Add channel breakdowns in the AM Performance form.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-gray-900">Demo Source & Outreach Volume by Channel</span>
        <div className="flex gap-3 ml-auto">
          {channels.map((ch) => (
            <div key={ch} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={cn("w-2 h-2 rounded-sm", CH_COLORS[ch])} />
              {CH_LABELS[ch]}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/80">
                <th rowSpan={2} className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">AM</th>
                <th colSpan={5} className="text-center px-2 py-1 text-[9px] font-semibold text-blue-600 uppercase tracking-wider border-b border-gray-200">Demo Source</th>
                <th rowSpan={2} className="w-px bg-gray-200 border-b-2 border-gray-200"></th>
                <th colSpan={5} className="text-center px-2 py-1 text-[9px] font-semibold text-emerald-600 uppercase tracking-wider border-b border-gray-200">Outreach Volume</th>
              </tr>
              <tr className="bg-gray-50/80">
                <th className="text-right px-2 py-2 text-[10px] font-semibold text-gray-500 border-b-2 border-gray-200">Total</th>
                {channels.map((ch) => (
                  <th key={ch} className="text-right px-2 py-2 text-[10px] font-semibold text-gray-500 border-b-2 border-gray-200">{CH_LABELS[ch].slice(0, 5)}</th>
                ))}
                <th className="text-right px-2 py-2 text-[10px] font-semibold text-gray-500 border-b-2 border-gray-200">Total</th>
                {channels.map((ch) => (
                  <th key={ch} className="text-right px-2 py-2 text-[10px] font-semibold text-gray-500 border-b-2 border-gray-200">{CH_LABELS[ch].slice(0, 5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dc = row.demoChannels;
                const oc = row.outreachChannels;
                const dcTotal = dc ? dc.email + dc.calls + dc.linkedin + dc.waOther : 0;
                const ocTotal = oc ? oc.email + oc.calls + oc.linkedin + oc.waOther : 0;
                return (
                  <tr
                    key={row.name}
                    className={cn(
                      "border-t border-gray-100 hover:bg-gray-50/50",
                      row.status === "inactive" && "opacity-55"
                    )}
                  >
                    <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap text-sm">{row.name}</td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums font-semibold">{dcTotal || "—"}</td>
                    {channels.map((ch) => (
                      <td key={ch} className="px-2 py-2.5 text-right font-mono tabular-nums text-gray-600">
                        {dc ? (
                          <>
                            {dc[ch]}
                            {dcTotal > 0 && (
                              <span className="text-gray-400 ml-0.5">{Math.round((dc[ch] / dcTotal) * 100)}%</span>
                            )}
                          </>
                        ) : "—"}
                      </td>
                    ))}
                    <td className="w-px bg-gray-200"></td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums font-semibold">{ocTotal ? ocTotal.toLocaleString() : "—"}</td>
                    {channels.map((ch) => (
                      <td key={ch} className="px-2 py-2.5 text-right font-mono tabular-nums text-gray-600">
                        {oc ? (
                          <>
                            {oc[ch].toLocaleString()}
                            {ocTotal > 0 && (
                              <span className="text-gray-400 ml-0.5">{Math.round((oc[ch] / ocTotal) * 100)}%</span>
                            )}
                          </>
                        ) : "—"}
                      </td>
                    ))}
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
