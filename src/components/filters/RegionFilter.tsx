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
        <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-input px-2 py-1.5 hover:bg-surface-2">
          <input
            type="checkbox"
            checked={activeRegions.includes(r)}
            onChange={() => toggle(r)}
            className="h-4 w-4 rounded accent-accent-primary"
          />
          <span className={cn("text-sm", activeRegions.includes(r) ? "text-text-primary font-medium" : "text-text-secondary")}>
            {r}
          </span>
        </label>
      ))}
    </div>
  );
}
