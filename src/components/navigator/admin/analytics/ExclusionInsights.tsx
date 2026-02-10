"use client";

import { AdminSection } from "../AdminSection";
import { pick } from "@/lib/navigator/ui-copy";

interface ExclusionData {
  byType: Record<string, number>;
  topReasons: { reason: string; count: number }[];
  bySource: Record<string, number>;
  recent: {
    type: string;
    value: string;
    reason: string | null;
    addedBy: string | null;
    addedAt: string;
  }[];
}

export function ExclusionInsights({ data }: { data: ExclusionData | null }) {
  if (!data) {
    return (
      <AdminSection title="Exclusion Insights">
        <div className="shimmer h-32 rounded-card" />
      </AdminSection>
    );
  }

  const totalExclusions = Object.values(data.byType).reduce((a, b) => a + b, 0);

  if (totalExclusions === 0) {
    return (
      <AdminSection title="Exclusion Insights">
        <p className="text-xs italic text-text-tertiary">{pick("empty_exclusions")}</p>
      </AdminSection>
    );
  }

  return (
    <AdminSection title="Exclusion Insights">
      <div className="space-y-5">
        {/* Summary row */}
        <div className="flex gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
              Total
            </p>
            <p className="font-mono text-lg text-text-primary">
              {totalExclusions}
            </p>
          </div>
          {Object.entries(data.byType).map(([type, count]) => (
            <div key={type}>
              <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                {type}
              </p>
              <p className="font-mono text-lg text-text-primary">{count}</p>
            </div>
          ))}
          {Object.entries(data.bySource).map(([source, count]) => (
            <div key={source}>
              <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                via {source}
              </p>
              <p className="font-mono text-lg text-text-primary">{count}</p>
            </div>
          ))}
        </div>

        {/* Top Reasons */}
        {data.topReasons.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-text-tertiary">
              Top Reasons
            </p>
            <div className="space-y-1">
              {data.topReasons.map((r) => {
                const maxCount = data.topReasons[0].count;
                return (
                  <div key={r.reason} className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-surface-3">
                      <div
                        className="h-1.5 rounded-full bg-accent-primary transition-all duration-300"
                        style={{
                          width: `${Math.round((r.count / maxCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-text-secondary">{r.reason}</span>
                    <span className="font-mono text-[10px] text-text-tertiary">
                      {r.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent exclusions */}
        {data.recent.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wide text-text-tertiary">
              Recent
            </p>
            <div className="space-y-1">
              {data.recent.slice(0, 5).map((e, i) => (
                <div
                  key={`${e.value}-${i}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
                    {e.type}
                  </span>
                  <span className="text-text-primary">{e.value}</span>
                  {e.addedBy && (
                    <span className="text-text-tertiary">by {e.addedBy}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
