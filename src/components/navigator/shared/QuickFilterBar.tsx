"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/navigator/store";
import type { QuickFilter } from "@/lib/navigator/types";

const chipConfig: { key: QuickFilter; label: string }[] = [
  { key: "has_signals", label: "Has Signals" },
  { key: "not_in_freshsales", label: "Not in CRM" },
  { key: "high_icp", label: "High ICP (\u226580)" },
  { key: "has_contacts", label: "Has Contacts" },
  { key: "unreviewed", label: "Unreviewed" },
  { key: "reviewed", label: "Reviewed" },
];

export function QuickFilterBar() {
  const quickFilters = useStore((s) => s.filters.quickFilters);
  const toggleQuickFilter = useStore((s) => s.toggleQuickFilter);
  const counts = useStore((s) => s.quickFilterCounts());

  const activeCount = quickFilters.filter((f) =>
    chipConfig.some((c) => c.key === f)
  ).length;

  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <div className="flex flex-wrap gap-1.5">
        {chipConfig.map(({ key, label }) => {
          const active = quickFilters.includes(key);
          const count = counts?.[key];
          const isEmpty = count === 0;
          return (
            <button
              key={key}
              onClick={() => toggleQuickFilter(key)}
              className={cn(
                "rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-all duration-[180ms]",
                active
                  ? "bg-accent-primary/15 text-accent-primary border-accent-primary/30"
                  : "border-surface-3 text-text-secondary hover:text-text-primary",
                isEmpty && !active && "opacity-50"
              )}
            >
              {label}
              {count != null && (
                <span className="ml-1 tabular-nums text-text-tertiary">{count}</span>
              )}
            </button>
          );
        })}
      </div>
      {activeCount > 0 && (
        <span className="text-[10px] text-text-tertiary tabular-nums">
          {activeCount} active
        </span>
      )}
    </div>
  );
}
