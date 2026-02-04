"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/navigator/store";
import { useMemo } from "react";

/**
 * Dynamic refinement chips extracted from search results.
 * Shows top verticals and regions by frequency, toggleable to filter client-side.
 */
export function ResultFilterChips() {
  const companies = useStore((s) => s.companies);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

  const { topVerticals, topRegions } = useMemo(() => {
    const verticalCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();

    for (const c of companies) {
      if (c.industry) {
        verticalCounts.set(c.industry, (verticalCounts.get(c.industry) || 0) + 1);
      }
      if (c.region) {
        regionCounts.set(c.region, (regionCounts.get(c.region) || 0) + 1);
      }
    }

    const topVerticals = [...verticalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    const topRegions = [...regionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);

    return { topVerticals, topRegions };
  }, [companies]);

  if (topVerticals.length === 0 && topRegions.length === 0) return null;

  const toggleVertical = (v: string) => {
    const current = filters.verticals;
    const next = current.includes(v)
      ? current.filter((x) => x !== v)
      : [...current, v];
    setFilters({ verticals: next });
  };

  const toggleRegion = (r: string) => {
    const current = filters.regions;
    const next = current.includes(r)
      ? current.filter((x) => x !== r)
      : [...current, r];
    setFilters({ regions: next });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {topVerticals.map((v) => {
        const active = filters.verticals.includes(v);
        return (
          <button
            key={`v-${v}`}
            onClick={() => toggleVertical(v)}
            className={cn(
              "rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-all duration-[var(--transition-default)]",
              active
                ? "border-accent-primary bg-accent-primary-light text-accent-primary"
                : "border-surface-3 bg-surface-1 text-text-tertiary hover:border-surface-3 hover:text-text-secondary"
            )}
          >
            {v}
          </button>
        );
      })}
      {topRegions.map((r) => {
        const active = filters.regions.includes(r);
        return (
          <button
            key={`r-${r}`}
            onClick={() => toggleRegion(r)}
            className={cn(
              "rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-all duration-[var(--transition-default)]",
              active
                ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
                : "border-surface-3 bg-surface-1 text-text-tertiary hover:border-surface-3 hover:text-text-secondary"
            )}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
