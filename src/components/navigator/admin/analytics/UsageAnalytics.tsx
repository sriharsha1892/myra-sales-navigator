"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DaySummary {
  date: string;
  events: Record<string, number>;
}

interface SummaryData {
  summary: DaySummary[];
  totals: Record<string, number>;
  byUser: Record<string, Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = ["search", "dossier_view", "export", "draft", "enrollment"] as const;

const EVENT_LABELS: Record<string, string> = {
  search: "Searches",
  dossier_view: "Dossier Views",
  export: "Exports",
  draft: "Drafts",
  enrollment: "Enrollments",
};

const EVENT_COLORS: Record<string, string> = {
  search: "bg-accent-secondary",
  dossier_view: "bg-accent-primary",
  export: "bg-success",
  draft: "bg-warning",
  enrollment: "bg-[#a78bfa]",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsageAnalytics() {
  const [days, setDays] = useState(7);

  const { data, isLoading, error } = useQuery<SummaryData>({
    queryKey: ["usage-analytics", days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/summary?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch usage analytics");
      return res.json();
    },
    staleTime: 60_000, // 1 min
  });

  // Compute the max count in any cell for proportional display
  const maxCount = useMemo(() => {
    if (!data?.summary) return 1;
    let max = 0;
    for (const day of data.summary) {
      for (const type of EVENT_TYPES) {
        const count = day.events[type] ?? 0;
        if (count > max) max = count;
      }
    }
    return Math.max(max, 1);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Usage Events
        </h3>
        <div className="flex items-center gap-1">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-input px-2 py-1 text-[10px] font-medium transition-all duration-180 ${
                days === d
                  ? "bg-accent-primary text-text-inverse"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          <div className="shimmer h-8 rounded-card" />
          <div className="shimmer h-32 rounded-card" />
          <div className="shimmer h-24 rounded-card" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-card border border-danger/30 bg-danger-light px-4 py-3">
          <p className="text-sm text-danger">
            Failed to load usage analytics. Is the usage_events table created
            in Supabase?
          </p>
        </div>
      )}

      {/* Data display */}
      {data && !isLoading && (
        <>
          {/* Totals row */}
          <div className="grid grid-cols-5 gap-2">
            {EVENT_TYPES.map((type) => (
              <div
                key={type}
                className="rounded-card border border-surface-3 bg-surface-1 p-3 text-center"
              >
                <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                  {EVENT_LABELS[type]}
                </p>
                <p className="mt-1 font-mono text-lg text-text-primary">
                  {data.totals[type] ?? 0}
                </p>
              </div>
            ))}
          </div>

          {/* Date x event_type table */}
          {data.summary.length > 0 ? (
            <div className="overflow-hidden rounded-card border border-surface-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-3 bg-surface-1">
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">
                      Date
                    </th>
                    {EVENT_TYPES.map((type) => (
                      <th
                        key={type}
                        className="px-3 py-2 text-right font-medium text-text-secondary"
                      >
                        {EVENT_LABELS[type]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.summary.map((day) => (
                    <tr
                      key={day.date}
                      className="border-b border-surface-3 last:border-0"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-text-primary">
                        {formatDate(day.date)}
                      </td>
                      {EVENT_TYPES.map((type) => {
                        const count = day.events[type] ?? 0;
                        return (
                          <td key={type} className="px-3 py-2 text-right">
                            {count > 0 ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <div
                                  className={`h-2 rounded ${EVENT_COLORS[type]}`}
                                  style={{
                                    width: `${Math.max((count / maxCount) * 48, 4)}px`,
                                  }}
                                />
                                <span className="font-mono text-text-primary">
                                  {count}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-text-tertiary">
                                0
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-surface-3 bg-surface-1">
                    <td className="px-3 py-2 font-semibold text-text-primary">
                      Total
                    </td>
                    {EVENT_TYPES.map((type) => (
                      <td
                        key={type}
                        className="px-3 py-2 text-right font-mono font-semibold text-text-primary"
                      >
                        {data.totals[type] ?? 0}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">
              No usage events recorded in the last {days} days.
            </p>
          )}

          {/* Per-user breakdown */}
          {Object.keys(data.byUser).length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-text-secondary">
                Per-User Breakdown
              </h4>
              <div className="overflow-hidden rounded-card border border-surface-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-3 bg-surface-1">
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">
                        User
                      </th>
                      {EVENT_TYPES.map((type) => (
                        <th
                          key={type}
                          className="px-3 py-2 text-right font-medium text-text-secondary"
                        >
                          {EVENT_LABELS[type]}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-medium text-text-secondary">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byUser)
                      .sort(([, a], [, b]) => {
                        const totalA = Object.values(a).reduce(
                          (sum, v) => sum + v,
                          0
                        );
                        const totalB = Object.values(b).reduce(
                          (sum, v) => sum + v,
                          0
                        );
                        return totalB - totalA;
                      })
                      .map(([userName, events]) => {
                        const total = Object.values(events).reduce(
                          (sum, v) => sum + v,
                          0
                        );
                        return (
                          <tr
                            key={userName}
                            className="border-b border-surface-3 last:border-0"
                          >
                            <td className="px-3 py-2 text-text-primary capitalize">
                              {userName}
                            </td>
                            {EVENT_TYPES.map((type) => (
                              <td
                                key={type}
                                className="px-3 py-2 text-right font-mono"
                              >
                                {events[type] ? (
                                  <span className="text-text-primary">
                                    {events[type]}
                                  </span>
                                ) : (
                                  <span className="text-text-tertiary">0</span>
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary">
                              {total}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
