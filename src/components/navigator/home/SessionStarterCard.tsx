"use client";

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";

interface SessionInsights {
  staleResearching: { domain: string; name: string; daysSince: number }[];
  followUpCount: number;
  recentVerticals: string[];
  suggestedVertical: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function SessionStarterCard() {
  const userName = useStore((s) => s.userName);
  const searchResults = useStore((s) => s.searchResults);
  const setViewMode = useStore((s) => s.setViewMode);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const selectCompany = useStore((s) => s.selectCompany);

  const { data: insights } = useQuery<SessionInsights>({
    queryKey: ["session-insights", userName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userName) params.set("user", userName);
      const res = await fetch(`/api/session/insights?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 300_000,
    enabled: searchResults === null,
  });

  // Only show in empty state (before first search)
  if (searchResults !== null) return null;
  if (!insights) return null;

  const hasStale = insights.staleResearching.length > 0;
  const hasFollowUps = insights.followUpCount > 0;
  const hasSuggested = !!insights.suggestedVertical;

  // Don't show if nothing to display
  if (!hasStale && !hasFollowUps && !hasSuggested) return null;

  return (
    <div className="w-full max-w-lg animate-fadeInUp rounded-card border border-surface-3 bg-surface-1 px-5 py-4">
      <p className="text-sm text-text-secondary">
        {getGreeting()}, <span className="font-medium text-text-primary">{userName}</span>
      </p>

      <div className="mt-3 space-y-2.5">
        {/* Stale pipeline */}
        {hasStale && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-primary">
                {insights.staleResearching.length} compan{insights.staleResearching.length !== 1 ? "ies" : "y"} stuck in Researching
              </p>
              <p className="text-xs text-text-tertiary">
                {insights.staleResearching
                  .slice(0, 3)
                  .map((c) => `${c.name} (${c.daysSince}d)`)
                  .join(", ")}
              </p>
            </div>
            <button
              onClick={() => {
                // Click first stale company
                const first = insights.staleResearching[0];
                if (first) selectCompany(first.domain);
              }}
              className="flex-shrink-0 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-3"
            >
              Review
            </button>
          </div>
        )}

        {/* Follow-ups due */}
        {hasFollowUps && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-primary">
              {insights.followUpCount} export{insights.followUpCount !== 1 ? "s" : ""} need follow-up
            </p>
            <button
              onClick={() => setViewMode("exported")}
              className="flex-shrink-0 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-3"
            >
              View exports
            </button>
          </div>
        )}

        {/* Suggested vertical */}
        {hasSuggested && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-primary">
              Try exploring: <span className="text-accent-primary">{insights.suggestedVertical}</span>
            </p>
            <button
              onClick={() =>
                setPendingFreeTextSearch(`${insights.suggestedVertical} companies`)
              }
              className="flex-shrink-0 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-3"
            >
              Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
