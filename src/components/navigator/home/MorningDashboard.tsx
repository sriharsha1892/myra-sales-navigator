"use client";

import { useStore } from "@/lib/navigator/store";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { DueStepsWidget } from "@/components/navigator/outreach/DueStepsWidget";
import { RecentExportsWidget } from "@/components/navigator/home/RecentExportsWidget";

export function MorningDashboard() {
  const userName = useStore((s) => s.userName);
  const presets = useStore((s) => s.presets);
  const loadPreset = useStore((s) => s.loadPreset);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const prospectList = useStore((s) => s.prospectList);
  const { history } = useSearchHistory();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="flex h-full flex-col items-center px-6 py-8 overflow-y-auto">
      <h2 className="animate-fadeInUp font-display text-2xl text-text-primary">
        {greeting}, {userName ?? "there"}
      </h2>
      <p className="animate-fadeInUp mt-1 text-sm text-text-secondary" style={{ animationDelay: "40ms" }}>
        What are you prospecting today?
      </p>

      {/* Due Steps */}
      <div className="animate-fadeInUp mt-6 w-full max-w-lg" style={{ animationDelay: "80ms" }}>
        <DueStepsWidget />
      </div>

      {/* Recent Exports */}
      <div className="animate-fadeInUp mt-4 w-full max-w-lg" style={{ animationDelay: "100ms" }}>
        <RecentExportsWidget />
      </div>

      {/* Prospect list resume */}
      {prospectList.size > 0 && (
        <div className="animate-fadeInUp mt-4" style={{ animationDelay: "140ms" }}>
          <span className="text-xs text-text-tertiary">
            {prospectList.size} prospect{prospectList.size === 1 ? "" : "s"} in your list
          </span>
        </div>
      )}

      {/* Recent searches */}
      {history.length > 0 && (
        <div className="animate-fadeInUp mt-6 w-full max-w-lg" style={{ animationDelay: "180ms" }}>
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Recent Searches
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {history.slice(0, 6).map((h, i) => (
              <button
                key={h.id ?? i}
                onClick={() => setPendingFreeTextSearch(h.label ?? "")}
                className="btn-press rounded-pill border border-surface-3 bg-surface-1 px-4 py-2 text-sm font-medium text-text-secondary shadow-sm transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-md hover:text-text-primary max-w-[220px] truncate"
                title={h.label}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Team presets */}
      {presets.length > 0 && (
        <div className="animate-fadeInUp mt-6 w-full max-w-lg" style={{ animationDelay: "260ms" }}>
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Team Presets
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {presets.slice(0, 6).map((preset) => (
              <button
                key={preset.id}
                onClick={() => loadPreset(preset.id)}
                className="relative rounded-pill border border-accent-primary/20 bg-accent-primary/5 px-3 py-1.5 text-xs text-accent-primary transition-colors hover:bg-accent-primary/10 hover:border-accent-primary/40"
              >
                {preset.name}
                {(preset.newResultCount ?? 0) > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-primary px-1 font-mono text-[9px] font-bold text-surface-0">
                    {preset.newResultCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
