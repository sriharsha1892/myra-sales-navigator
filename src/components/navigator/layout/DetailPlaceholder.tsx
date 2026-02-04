"use client";

import { useStore } from "@/lib/navigator/store";
import { SourceBadge } from "@/components/navigator/badges";

const signalPillColors: Record<string, string> = {
  hiring: "bg-info-light text-accent-primary",
  funding: "bg-success-light text-success",
  expansion: "bg-warning-light text-warning",
  news: "bg-surface-2 text-text-secondary",
};

export function DetailPlaceholder() {
  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const companies = filteredCompanies();

  const avg =
    companies.length > 0
      ? Math.round(companies.reduce((s, c) => s + c.icpScore, 0) / companies.length)
      : 0;
  const avgColor =
    avg >= 80 ? "text-accent-highlight" : avg >= 60 ? "text-accent-primary" : avg >= 40 ? "text-warning" : "text-text-tertiary";

  // Signal breakdown
  const signalCounts: Record<string, number> = {};
  for (const c of companies) {
    for (const s of c.signals) {
      signalCounts[s.type] = (signalCounts[s.type] ?? 0) + 1;
    }
  }

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  for (const c of companies) {
    for (const src of c.sources) {
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }
  }

  return (
    <div className="flex w-[420px] flex-shrink-0 flex-col items-center justify-center border-l border-surface-3 bg-surface-0 px-6">
      <p className="font-display text-lg text-text-secondary">Click a company</p>
      <p className="mt-1 text-sm text-text-tertiary">to see its details, contacts, and recent activity</p>

      <div className="my-4 h-px w-24 bg-surface-3" />

      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-sm text-text-secondary">
          {companies.length} companies
        </span>
        <span className={`font-mono text-sm ${avgColor}`}>
          Avg match score: {avg} / 100
        </span>

        {Object.keys(signalCounts).length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {Object.entries(signalCounts).map(([type, count]) => (
              <span
                key={type}
                className={`rounded-pill px-2 py-0.5 text-[10px] font-medium capitalize ${signalPillColors[type] ?? signalPillColors.news}`}
              >
                {type} ({count})
              </span>
            ))}
          </div>
        )}

        {Object.keys(sourceCounts).length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {Object.entries(sourceCounts).map(([src, count]) => (
              <span key={src} className="flex items-center gap-1">
                <SourceBadge source={src as "exa" | "apollo" | "hubspot"} />
                <span className="font-mono text-[10px] text-text-tertiary">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
