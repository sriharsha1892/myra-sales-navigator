"use client";

import { useStore } from "@/lib/navigator/store";

export function SimilarSearchBanner() {
  const match = useStore((s) => s.similarSearchMatch);
  const dismiss = useStore((s) => s.dismissSimilarSearch);

  if (!match) return null;

  const daysAgo = Math.floor(
    (Date.now() - new Date(match.at).getTime()) / 86400000
  );
  const timeLabel =
    daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;

  return (
    <div className="mb-3 flex items-center justify-between rounded-card border border-surface-3 bg-surface-1/80 px-3 py-2 backdrop-blur-sm animate-in fade-in duration-200">
      <p className="text-xs text-text-secondary">
        <span className="font-medium text-text-primary">{match.user}</span>
        {" searched "}
        <span className="italic text-accent-secondary">
          &ldquo;{match.query}&rdquo;
        </span>{" "}
        {timeLabel} &mdash; {match.resultCount} results
      </p>
      <button
        onClick={dismiss}
        className="ml-3 flex-shrink-0 text-[10px] text-text-tertiary hover:text-text-secondary"
      >
        Dismiss
      </button>
    </div>
  );
}
