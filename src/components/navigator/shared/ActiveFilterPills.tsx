"use client";

import { useStore } from "@/lib/navigator/store";
import type { FilterState, SizeBucket, SignalType, ResultSource } from "@/lib/navigator/types";

const sizeLabels: Record<SizeBucket, string> = {
  "1-50": "1–50 emp",
  "51-200": "51–200 emp",
  "201-1000": "201–1K emp",
  "1000+": "1K+ emp",
};

export function ActiveFilterPills() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);
  const setLastSearchQuery = useStore((s) => s.setLastSearchQuery);
  const setSearchResults = useStore((s) => s.setSearchResults);

  const pills: { label: string; category: string; onRemove: () => void }[] = [];

  // Free-text query pill
  if (lastSearchQuery) {
    pills.push({
      label: `"${lastSearchQuery.length > 40 ? lastSearchQuery.slice(0, 40) + "…" : lastSearchQuery}"`,
      category: "query",
      onRemove: () => {
        setLastSearchQuery(null);
        setSearchResults(null);
      },
    });
  }

  // Vertical pills
  for (const v of filters.verticals) {
    pills.push({
      label: v,
      category: "vertical",
      onRemove: () => setFilters({ verticals: filters.verticals.filter((x) => x !== v) }),
    });
  }

  // Region pills (only if not all selected)
  const allRegions = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"];
  if (filters.regions.length > 0 && filters.regions.length < allRegions.length) {
    for (const r of filters.regions) {
      pills.push({
        label: r,
        category: "region",
        onRemove: () => setFilters({ regions: filters.regions.filter((x) => x !== r) }),
      });
    }
  }

  // Size pills (only if not all selected)
  if (filters.sizes.length > 0 && filters.sizes.length < 4) {
    for (const s of filters.sizes) {
      pills.push({
        label: sizeLabels[s] ?? s,
        category: "size",
        onRemove: () => setFilters({ sizes: filters.sizes.filter((x) => x !== s) as SizeBucket[] }),
      });
    }
  }

  // Signal pills (only if not all selected)
  if (filters.signals.length > 0 && filters.signals.length < 4) {
    for (const sig of filters.signals) {
      pills.push({
        label: sig.charAt(0).toUpperCase() + sig.slice(1),
        category: "signal",
        onRemove: () => setFilters({ signals: filters.signals.filter((x) => x !== sig) as SignalType[] }),
      });
    }
  }

  // Status pills
  for (const st of filters.statuses) {
    pills.push({
      label: st,
      category: "status",
      onRemove: () => setFilters({ statuses: filters.statuses.filter((x) => x !== st) }),
    });
  }

  if (pills.length === 0) return null;

  const clearAll = () => {
    setFilters({
      verticals: [],
      regions: allRegions,
      sizes: ["1-50", "51-200", "201-1000", "1000+"],
      signals: ["hiring", "funding", "expansion", "news"],
      statuses: [],
    });
    setLastSearchQuery(null);
    setSearchResults(null);
  };

  const categoryColors: Record<string, string> = {
    query: "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
    vertical: "border-accent-primary/30 bg-accent-primary/5 text-accent-primary",
    region: "border-accent-secondary/30 bg-accent-secondary/5 text-accent-secondary",
    size: "border-purple-500/30 bg-purple-500/5 text-purple-400",
    signal: "border-green-500/30 bg-green-500/5 text-green-400",
    status: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pills.map((pill, i) => (
        <span
          key={`${pill.category}-${pill.label}-${i}`}
          className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-sm font-medium ${categoryColors[pill.category] ?? "border-surface-3 text-text-secondary"}`}
        >
          {pill.label}
          <button
            onClick={(e) => {
              e.stopPropagation();
              pill.onRemove();
            }}
            className="-mr-0.5 flex h-5 w-5 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
            aria-label={`Remove ${pill.label}`}
          >
            &times;
          </button>
        </span>
      ))}
      {pills.length > 2 && (
        <button
          onClick={clearAll}
          className="text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
