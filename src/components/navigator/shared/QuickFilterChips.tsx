"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/navigator/store";
import type { QuickFilter } from "@/lib/navigator/types";

const chipConfig: { key: QuickFilter; label: string }[] = [
  { key: "high_icp", label: "High ICP (80+)" },
  { key: "has_signals", label: "Has Buying Signals" },
  { key: "not_in_hubspot", label: "Not in HubSpot" },
  { key: "verified_email", label: "Verified Email" },
];

export function QuickFilterChips() {
  const quickFilters = useStore((s) => s.filters.quickFilters);
  const toggleQuickFilter = useStore((s) => s.toggleQuickFilter);

  return (
    <div className="flex flex-wrap gap-1.5">
      {chipConfig.map(({ key, label }) => {
        const active = quickFilters.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggleQuickFilter(key)}
            className={cn(
              "rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-all duration-[var(--transition-default)]",
              active
                ? "border-accent-primary bg-accent-primary-light text-accent-primary"
                : "border-surface-3 bg-surface-1 text-text-tertiary hover:border-surface-3 hover:text-text-secondary"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
