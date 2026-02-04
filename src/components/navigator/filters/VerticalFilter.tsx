"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/navigator/store";

export function VerticalFilter() {
  const verticals = useStore((s) => s.adminConfig.verticals);
  const activeVerticals = useStore((s) => s.filters.verticals);
  const setFilters = useStore((s) => s.setFilters);
  const [search, setSearch] = useState("");

  const filtered = verticals.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (vertical: string) => {
    const next = activeVerticals.includes(vertical)
      ? activeVerticals.filter((v) => v !== vertical)
      : [...activeVerticals, vertical];
    setFilters({ verticals: next });
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search verticals..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        data-filter-search
        className="mb-1.5 w-full rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
      />
      <div className="max-h-32 space-y-0.5 overflow-y-auto">
        {filtered.map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-2.5 rounded-input px-2 py-1.5 hover:bg-surface-2">
            <input
              type="checkbox"
              checked={activeVerticals.includes(v)}
              onChange={() => toggle(v)}
              className="h-4 w-4 rounded accent-accent-primary"
            />
            <span className={cn("text-sm", activeVerticals.includes(v) ? "text-text-primary font-medium" : "text-text-secondary")}>
              {v}
            </span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="py-1 text-xs italic text-text-tertiary">No verticals match</p>
        )}
      </div>
    </div>
  );
}
