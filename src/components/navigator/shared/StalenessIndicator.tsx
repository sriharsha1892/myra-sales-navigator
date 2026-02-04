"use client";

import { cn } from "@/lib/cn";

interface StalenessIndicatorProps {
  lastRefreshed: string;
  onRefresh?: () => void;
  className?: string;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return "Unknown";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function StalenessIndicator({ lastRefreshed, onRefresh, className }: StalenessIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs text-text-tertiary", className)}>
      <span>Last refreshed: {formatTimeAgo(lastRefreshed)}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="text-text-tertiary transition-colors hover:text-accent-primary"
          title="Refresh data"
          aria-label="Refresh data"
        >
          &#x21bb;
        </button>
      )}
    </span>
  );
}
