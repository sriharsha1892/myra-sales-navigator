"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";

const regions = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"];

export function RegionFilter() {
  const activeRegions = useStore((s) => s.filters.regions);
  const setFilters = useStore((s) => s.setFilters);

  const toggle = (region: string) => {
    const next = activeRegions.includes(region)
      ? activeRegions.filter((r) => r !== region)
      : [...activeRegions, region];
    setFilters({ regions: next });
  };

  return (
    <div className="space-y-0.5">
      {regions.map((r) => (
        <label key={r} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 hover:bg-surface-hover">
          <input
            type="checkbox"
            checked={activeRegions.includes(r)}
            onChange={() => toggle(r)}
            className="h-3 w-3 rounded accent-accent-primary"
          />
          <span className={cn("text-xs", activeRegions.includes(r) ? "text-text-primary" : "text-text-secondary")}>
            {r}
          </span>
        </label>
      ))}
    </div>
  );
}
