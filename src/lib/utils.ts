import type { FilterState, SizeBucket } from "./types";

export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function summarizeFilters(filters: FilterState): string {
  const parts: string[] = [];

  if (filters.verticals.length > 0) {
    parts.push(filters.verticals.slice(0, 2).join(", "));
    if (filters.verticals.length > 2) parts[parts.length - 1] += ` +${filters.verticals.length - 2}`;
  }
  if (filters.regions.length > 0) {
    parts.push(filters.regions.slice(0, 2).join(", "));
    if (filters.regions.length > 2) parts[parts.length - 1] += ` +${filters.regions.length - 2}`;
  }
  if (filters.sizes.length > 0) {
    parts.push(filters.sizes.join(", "));
  }
  if (filters.signals.length > 0) {
    parts.push(filters.signals.join(", "));
  }

  return parts.length > 0 ? parts.join(", ") : "All filters";
}

export function getSizeBucket(count: number): SizeBucket {
  if (count <= 50) return "1-50";
  if (count <= 200) return "51-200";
  if (count <= 1000) return "201-1000";
  return "1000+";
}
