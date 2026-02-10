"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/navigator/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelevanceAggregateData {
  summary: { relevant: number; notRelevant: number };
  reasons: { reason: string; count: number }[];
  topIndustries: { value: string; count: number }[];
  topRegions: { value: string; count: number }[];
  topSizes: { value: string; count: number }[];
}

interface RelevanceInsightsProps {
  dateRange?: number; // days, default 7
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REASON_LABELS: Record<string, string> = {
  wrong_industry: "Wrong industry",
  wrong_region: "Wrong region",
  wrong_size: "Too small/large",
  no_actionable_contacts: "No contacts",
  irrelevant_signals: "Stale signals",
};

const ALL_REASONS = [
  "wrong_industry",
  "wrong_region",
  "wrong_size",
  "no_actionable_contacts",
  "irrelevant_signals",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RelevanceInsightsSection({ dateRange = 7 }: RelevanceInsightsProps) {
  const queryClient = useQueryClient();
  const updateAdminConfig = useStore((s) => s.updateAdminConfig);
  const saveAdminConfig = useStore((s) => s.saveAdminConfig);
  const icpWeights = useStore((s) => s.adminConfig.icpWeights);

  const [applyingId, setApplyingId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
  } = useQuery<RelevanceAggregateData>({
    queryKey: ["relevance-insights", dateRange],
    queryFn: async () => {
      const res = await fetch(
        `/api/relevance-feedback?aggregate=true&days=${dateRange}`
      );
      if (!res.ok) throw new Error("Failed to fetch relevance insights");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Compute the max reason count for proportional bar widths
  const maxReasonCount = useMemo(() => {
    if (!data?.reasons) return 1;
    let max = 0;
    for (const r of data.reasons) {
      if (r.count > max) max = r.count;
    }
    return Math.max(max, 1);
  }, [data]);

  // Build a lookup from reason key -> count
  const reasonLookup = useMemo(() => {
    const map = new Map<string, number>();
    if (data?.reasons) {
      for (const r of data.reasons) {
        map.set(r.reason, r.count);
      }
    }
    return map;
  }, [data]);

  // Compute suggestions
  const suggestions = useMemo(() => {
    if (!data) return [];
    const total = data.summary.notRelevant;
    if (total < 5) return []; // Not enough data

    const items: {
      id: string;
      description: string;
      weightKey: keyof typeof icpWeights;
      delta: number;
    }[] = [];

    const wrongIndustry = reasonLookup.get("wrong_industry") ?? 0;
    const wrongRegion = reasonLookup.get("wrong_region") ?? 0;
    const wrongSize = reasonLookup.get("wrong_size") ?? 0;
    const irrelevantSignals = reasonLookup.get("irrelevant_signals") ?? 0;
    const noContacts = reasonLookup.get("no_actionable_contacts") ?? 0;

    if (wrongIndustry / total > 0.3) {
      items.push({
        id: "vertical",
        description: `Increase vertical match weight by +10 (currently ${icpWeights.verticalMatch})`,
        weightKey: "verticalMatch",
        delta: 10,
      });
    }
    if (wrongRegion / total > 0.3) {
      items.push({
        id: "region",
        description: `Increase region match weight by +10 (currently ${icpWeights.regionMatch})`,
        weightKey: "regionMatch",
        delta: 10,
      });
    }
    if (wrongSize / total > 0.3) {
      items.push({
        id: "size",
        description: `Increase size match weight by +10 (currently ${icpWeights.sizeMatch})`,
        weightKey: "sizeMatch",
        delta: 10,
      });
    }
    if (irrelevantSignals / total > 0.3) {
      items.push({
        id: "signals",
        description: `Decrease buying signals weight by -5 (currently ${icpWeights.buyingSignals})`,
        weightKey: "buyingSignals",
        delta: -5,
      });
    }
    if (noContacts / total > 0.2) {
      items.push({
        id: "contacts",
        description: "Review contact data sources — high rate of companies with no actionable contacts",
        weightKey: "buyingSignals", // placeholder — no direct weight for this
        delta: 0,
      });
    }

    return items;
  }, [data, reasonLookup, icpWeights]);

  const handleApply = async (suggestion: (typeof suggestions)[number]) => {
    if (suggestion.delta === 0) return; // Info-only suggestion
    setApplyingId(suggestion.id);
    try {
      const newValue = icpWeights[suggestion.weightKey] + suggestion.delta;
      updateAdminConfig({
        icpWeights: { ...icpWeights, [suggestion.weightKey]: newValue },
      });
      await saveAdminConfig();
      queryClient.invalidateQueries({ queryKey: ["relevance-insights"] });
    } finally {
      setApplyingId(null);
    }
  };

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Relevance Feedback Insights
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="shimmer h-20 rounded-card" />
          <div className="shimmer h-20 rounded-card" />
        </div>
        <div className="shimmer h-32 rounded-card" />
        <div className="shimmer h-24 rounded-card" />
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Relevance Feedback Insights
        </h3>
        <div className="rounded-card border border-danger/30 bg-danger-light px-4 py-3">
          <p className="text-sm text-danger">
            Failed to load relevance feedback data.
          </p>
          <button
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["relevance-insights"],
              })
            }
            className="mt-2 rounded-input border border-surface-3 px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, topIndustries, topRegions, topSizes } = data;
  const hasAnyFeedback = summary.relevant + summary.notRelevant > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">
        Relevance Feedback Insights
        <span className="ml-2 text-[10px] font-normal text-text-tertiary">
          Last {dateRange} days
        </span>
      </h3>

      {!hasAnyFeedback ? (
        <p className="text-xs text-text-tertiary">
          No relevance feedback recorded in the last {dateRange} days.
        </p>
      ) : (
        <>
          {/* -------------------------------------------------------------- */}
          {/* Section A: Feedback Summary                                     */}
          {/* -------------------------------------------------------------- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-surface-3 bg-surface-1 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                Relevant
              </p>
              <p className="mt-1 font-mono text-2xl text-success">
                {summary.relevant}
              </p>
            </div>
            <div className="rounded-card border border-surface-3 bg-surface-1 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                Not Relevant
              </p>
              <p className="mt-1 font-mono text-2xl text-danger">
                {summary.notRelevant}
              </p>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Section B: Reason Distribution                                  */}
          {/* -------------------------------------------------------------- */}
          {summary.notRelevant > 0 && (
            <div className="rounded-card border border-surface-3 bg-surface-1 p-4">
              <h4 className="mb-3 text-xs font-semibold text-text-secondary">
                Reason Distribution
              </h4>
              <div className="space-y-2">
                {ALL_REASONS.map((reason) => {
                  const count = reasonLookup.get(reason) ?? 0;
                  const widthPct =
                    maxReasonCount > 0
                      ? Math.max((count / maxReasonCount) * 100, 0)
                      : 0;

                  return (
                    <div key={reason} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-[11px] text-text-secondary">
                        {REASON_LABELS[reason] ?? reason}
                      </span>
                      <div className="relative flex-1 h-4 rounded bg-surface-3/50">
                        {count > 0 && (
                          <div
                            className="h-full rounded bg-accent-primary transition-all duration-300"
                            style={{ width: `${widthPct}%` }}
                          />
                        )}
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-[10px] text-text-tertiary">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Section C: Top Downvoted Tables                                 */}
          {/* -------------------------------------------------------------- */}
          {summary.notRelevant > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TopTable title="Top Industries" rows={topIndustries} />
              <TopTable title="Top Regions" rows={topRegions} />
              <TopTable title="Top Sizes" rows={topSizes} />
            </div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Section D: Suggested ICP Adjustments                            */}
          {/* -------------------------------------------------------------- */}
          <div className="rounded-card border border-surface-3 bg-surface-1 p-4">
            <h4 className="mb-3 text-xs font-semibold text-text-secondary">
              Suggested ICP Adjustments
            </h4>
            {suggestions.length === 0 ? (
              <p className="text-[11px] text-text-tertiary">
                Not enough feedback data yet to generate suggestions.
              </p>
            ) : (
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-input border border-surface-3 bg-surface-0 px-3 py-2"
                  >
                    <span className="text-[11px] text-text-secondary">
                      {s.description}
                    </span>
                    {s.delta !== 0 && (
                      <button
                        onClick={() => handleApply(s)}
                        disabled={applyingId === s.id}
                        className="ml-3 shrink-0 rounded-input bg-accent-primary px-3 py-1 text-[10px] font-medium text-text-inverse transition-all duration-180 hover:bg-accent-primary-hover disabled:opacity-50"
                      >
                        {applyingId === s.id ? "Applying..." : "Apply"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: small table for top downvoted dimensions
// ---------------------------------------------------------------------------

function TopTable({
  title,
  rows,
}: {
  title: string;
  rows: { value: string; count: number }[];
}) {
  return (
    <div className="rounded-card border border-surface-3 bg-surface-1 p-3">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-[10px] text-text-tertiary">No data</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.value}
                className={i % 2 === 1 ? "bg-surface-0/50" : ""}
              >
                <td className="py-1 pr-2 text-text-secondary truncate max-w-[120px]">
                  {row.value}
                </td>
                <td className="py-1 text-right font-mono text-text-tertiary">
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
