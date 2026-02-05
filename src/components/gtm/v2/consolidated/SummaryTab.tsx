"use client";

import type { GtmEntry, GtmV2Segment } from "@/lib/gtm/v2-types";
import { ALL_V2_SEGMENTS, SEGMENT_LABELS, CHECKPOINT_COLORS } from "@/lib/gtm/v2-types";
import { formatEntryDate } from "@/lib/gtm/v2-utils";
import { cn } from "@/lib/cn";

interface Props {
  entries: GtmEntry[];
}

export function ConsolidatedSummary({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-sm text-gray-500">No checkpoint data available.</p>
      </div>
    );
  }

  const first = entries[0];
  const last = entries[entries.length - 1];

  // KPI cards
  const kpis = [
    {
      label: "Paying Customers",
      values: entries.map((e) => e.orgSnapshot?.counts?.paying ?? 0),
    },
    {
      label: "Strong Prospects",
      values: entries.map((e) => e.orgSnapshot?.counts?.prospect ?? 0),
    },
    {
      label: "Active Engagement",
      values: entries.map((e) => {
        const c = e.orgSnapshot?.counts;
        return (c?.paying ?? 0) + (c?.prospect ?? 0) + (c?.trial ?? 0);
      }),
    },
    {
      label: "Platform Cost (USD)",
      values: entries.map((e) => e.totalCostUsd),
      isCost: true,
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI grid */}
      <div className={cn(
        "grid gap-3.5",
        entries.length <= 3 ? "grid-cols-4" : "grid-cols-2"
      )}>
        {kpis.map((kpi) => {
          const net = kpi.values[kpi.values.length - 1] - kpi.values[0];
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
            >
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {kpi.label}
              </div>
              <div className="flex items-end gap-1">
                {kpi.values.map((v, i) => (
                  <div key={i} className="flex items-end gap-1 flex-1">
                    {i > 0 && <span className="text-gray-300 text-xs mb-3">&rarr;</span>}
                    <div className="flex flex-col items-center flex-1">
                      <span className={cn("font-mono text-xl font-medium", CHECKPOINT_COLORS[i % CHECKPOINT_COLORS.length])}>
                        {kpi.isCost ? v.toLocaleString() : v}
                      </span>
                      <span className="text-[9px] text-gray-400 font-mono mt-1">
                        {shortDate(entries[i].entryDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                <span>Net change</span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    net > 0 ? "text-emerald-700" : net < 0 ? "text-red-600" : "text-gray-400"
                  )}
                >
                  {net > 0 ? "+" : ""}{kpi.isCost ? net.toLocaleString() : net}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline progression table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="text-sm font-semibold text-gray-900 mb-4">
          Pipeline Progression{" "}
          <span className="font-normal text-gray-500 text-xs">all segments, all checkpoints</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">
                  Segment
                </th>
                {entries.map((e, i) => (
                  <th
                    key={e.entryDate}
                    className={cn(
                      "text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 border-gray-200",
                      CHECKPOINT_COLORS[i % CHECKPOINT_COLORS.length]
                    )}
                  >
                    {shortDate(e.entryDate)}
                  </th>
                ))}
                <th className="text-center px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">
                  Net &Delta;
                </th>
              </tr>
            </thead>
            <tbody>
              {ALL_V2_SEGMENTS.map((seg) => {
                const vals = entries.map((e) => e.orgSnapshot?.counts?.[seg] ?? 0);
                const net = vals[vals.length - 1] - vals[0];
                return (
                  <tr key={seg} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-900 text-sm">
                      {SEGMENT_LABELS[seg]}
                    </td>
                    {vals.map((v, i) => {
                      const prev = i > 0 ? vals[i - 1] : null;
                      const d = prev !== null ? v - prev : null;
                      return (
                        <td
                          key={i}
                          className={cn(
                            "text-center px-3 py-2.5 font-mono text-sm",
                            CHECKPOINT_COLORS[i % CHECKPOINT_COLORS.length]
                          )}
                        >
                          {v}
                          {d !== null && d !== 0 && (
                            <span
                              className={cn(
                                "ml-1 text-[10px] font-semibold px-1 py-0.5 rounded",
                                d > 0
                                  ? "text-emerald-700 bg-emerald-50"
                                  : "text-red-600 bg-red-50"
                              )}
                            >
                              {d > 0 ? "+" : ""}{d}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2.5">
                      <span
                        className={cn(
                          "font-mono font-semibold text-sm",
                          net > 0 ? "text-emerald-700" : net < 0 ? "text-red-600" : "text-gray-400"
                        )}
                      >
                        {net > 0 ? "+" : ""}{net}
                      </span>
                    </td>
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
