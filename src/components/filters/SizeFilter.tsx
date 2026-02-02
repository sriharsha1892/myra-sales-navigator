"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import type { SizeBucket } from "@/lib/types";

const buckets: { key: SizeBucket; label: string }[] = [
  { key: "1-50", label: "1–50" },
  { key: "51-200", label: "51–200" },
  { key: "201-1000", label: "201–1K" },
  { key: "1000+", label: "1K+" },
];

export function SizeFilter() {
  const activeSizes = useStore((s) => s.filters.sizes);
  const setFilters = useStore((s) => s.setFilters);

  const toggle = (size: SizeBucket) => {
    const next = activeSizes.includes(size)
      ? activeSizes.filter((s) => s !== size)
      : [...activeSizes, size];
    setFilters({ sizes: next });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {buckets.map(({ key, label }) => {
        const active = activeSizes.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={cn(
              "rounded-input border px-3 py-1.5 text-sm font-medium transition-all duration-[var(--transition-default)]",
              active
                ? "border-accent-primary bg-accent-primary-light text-accent-primary"
                : "border-surface-3 text-text-secondary hover:text-text-primary hover:border-surface-3/80"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
