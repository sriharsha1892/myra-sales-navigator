export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function isStale(lastRefreshed: string | null | undefined): boolean {
  if (!lastRefreshed) return true;
  const then = new Date(lastRefreshed).getTime();
  if (isNaN(then)) return true;
  return Date.now() - then > STALE_THRESHOLD_MS;
}

export function formatTimeAgo(dateStr: string): string {
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
