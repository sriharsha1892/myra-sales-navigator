import type { FilterState, SizeBucket } from "./navigator/types";

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
  const sizeLabels: Record<SizeBucket, string> = {
    "1-50": "small",
    "51-200": "mid-size",
    "201-1000": "large",
    "1000+": "enterprise",
  };

  // Build main part: "{size} {verticals} in {regions}"
  const main: string[] = [];

  // Size — omit if all 4 selected or none
  if (filters.sizes.length > 0 && filters.sizes.length < 4) {
    main.push(filters.sizes.map((s) => sizeLabels[s]).join(", "));
  }

  // Verticals — cap at 2 + overflow
  if (filters.verticals.length > 0) {
    let v = filters.verticals.slice(0, 2).join(", ");
    if (filters.verticals.length > 2) v += ` +${filters.verticals.length - 2}`;
    main.push(v);
  }

  // Regions — "in" preposition, cap at 2 + overflow
  if (filters.regions.length > 0) {
    let r = filters.regions.slice(0, 2).join(", ");
    if (filters.regions.length > 2) r += ` +${filters.regions.length - 2}`;
    main.push(`in ${r}`);
  }

  // Signals — omit if all 4 selected or none
  let signalPart = "";
  if (filters.signals.length > 0 && filters.signals.length < 4) {
    signalPart = filters.signals.join(", ");
  }

  if (main.length === 0 && !signalPart) return "All filters";

  const label = main.join(" ");
  if (signalPart) {
    return label ? `${label} · ${signalPart}` : signalPart;
  }
  return label;
}

export function getSizeBucket(count: number): SizeBucket {
  if (count <= 50) return "1-50";
  if (count <= 200) return "51-200";
  if (count <= 1000) return "201-1000";
  return "1000+";
}

/**
 * Limits concurrent promise execution. Returns a wrapper that queues
 * calls so at most `concurrency` run at once.
 */
export function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()!();
    }
  }

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve, reject).finally(() => {
          active--;
          next();
        });
      });
      next();
    });
}
