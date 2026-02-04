"use client";

import { useStore } from "@/lib/navigator/store";

export function ExclusionToggle() {
  const hideExcluded = useStore((s) => s.filters.hideExcluded);
  const setFilters = useStore((s) => s.setFilters);

  return (
    <label className="flex cursor-pointer items-center gap-2">
      <div className="relative">
        <input
          type="checkbox"
          checked={hideExcluded}
          onChange={(e) => setFilters({ hideExcluded: e.target.checked })}
          className="sr-only"
        />
        <div
          className={`h-5 w-9 rounded-full transition-colors duration-[var(--transition-default)] ${
            hideExcluded ? "bg-accent-primary" : "bg-surface-3"
          }`}
        />
        <div
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-text-inverse shadow-sm transition-transform duration-[var(--transition-default)] ${
            hideExcluded ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
      <span className="text-xs text-text-secondary">Hide excluded</span>
    </label>
  );
}
