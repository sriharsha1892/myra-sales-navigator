/**
 * Smart Engine Router — budget + health aware.
 *
 * Automatically routes searches to the cheapest healthy engine.
 * Exa is precious ($10.38 remaining) — never used as primary.
 * Parallel is the workhorse (20K free). Serper handles company names (2,500 free).
 *
 * Zero admin configuration. Fully autonomous.
 */

import { isExaAvailable } from "../providers/exa";
import { isSerperAvailable } from "../providers/serper";
import { isParallelAvailable } from "../providers/parallel";
import { getHealthSummary, type SourceHealth } from "../health";

// ---------------------------------------------------------------------------
// Daily budget limits (soft — derived from free tiers)
// ---------------------------------------------------------------------------

const DAILY_BUDGET: Record<string, number> = {
  exa: 5,        // ~70 total left, stretch over 2+ weeks
  parallel: 800, // 20K / 25 days
  serper: 100,   // 2,500 / 25 days
};

// ---------------------------------------------------------------------------
// In-memory daily usage counters
// ---------------------------------------------------------------------------

interface DailyCounter {
  count: number;
  date: string; // YYYY-MM-DD
}

const _dailyCounts = new Map<string, DailyCounter>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCount(source: string): number {
  const entry = _dailyCounts.get(source);
  if (!entry || entry.date !== todayKey()) return 0;
  return entry.count;
}

/**
 * Record one API call for a source engine.
 * Call this ONLY when an actual API request was made (not on cache hits).
 */
export function recordUsage(source: "exa" | "parallel" | "serper"): void {
  const today = todayKey();
  const entry = _dailyCounts.get(source);
  if (!entry || entry.date !== today) {
    _dailyCounts.set(source, { count: 1, date: today });
  } else {
    entry.count++;
  }
}

/**
 * Check if an engine is under its daily budget.
 */
export function isUnderBudget(source: string): boolean {
  return getCount(source) < (DAILY_BUDGET[source] ?? Infinity);
}

// ---------------------------------------------------------------------------
// Health check (cached — avoids DB hit per request)
// ---------------------------------------------------------------------------

let _healthCache: { data: Record<string, SourceHealth>; expiresAt: number } | null = null;

async function getEngineHealth(): Promise<Record<string, SourceHealth>> {
  if (_healthCache && Date.now() < _healthCache.expiresAt) {
    return _healthCache.data;
  }
  try {
    // 5-minute window for health assessment
    const summary = await getHealthSummary(0.083);
    _healthCache = { data: summary.sources, expiresAt: Date.now() + 2 * 60 * 1000 }; // cache 2 min
    return summary.sources;
  } catch {
    return {};
  }
}

function isHealthy(health: Record<string, SourceHealth>, source: string): boolean {
  const h = health[source];
  if (!h) return true; // no data = assume healthy (new engine, no calls yet)
  return h.status !== "down"; // allow "healthy" and "degraded"
}

// ---------------------------------------------------------------------------
// Engine selection
// ---------------------------------------------------------------------------

export type SearchEngine = "exa" | "parallel" | "serper";

/**
 * Pick the best discovery engine (for descriptive/filter-based searches).
 *
 * Priority: Parallel (huge free budget) → Exa (emergency fallback only).
 */
export async function pickDiscoveryEngine(): Promise<"parallel" | "exa"> {
  const health = await getEngineHealth();

  // Parallel is the default — check availability, health, budget
  if (isParallelAvailable() && isHealthy(health, "parallel") && isUnderBudget("parallel")) {
    return "parallel";
  }

  // Parallel unavailable/unhealthy/over-budget — try Exa if under its tiny budget
  if (isExaAvailable() && isHealthy(health, "exa") && isUnderBudget("exa")) {
    return "exa";
  }

  // Both over budget or unhealthy — still prefer Parallel (cheaper per query)
  if (isParallelAvailable()) {
    return "parallel";
  }

  // Last resort
  return "exa";
}

/**
 * Pick the best engine for company-name queries.
 *
 * Priority: Serper (Google exact match) → Exa (semantic fallback).
 */
export async function pickNameEngine(): Promise<"serper" | "exa"> {
  const health = await getEngineHealth();

  if (isSerperAvailable() && isHealthy(health, "serper") && isUnderBudget("serper")) {
    return "serper";
  }

  // Serper unavailable — try Exa if under budget
  if (isExaAvailable() && isHealthy(health, "exa") && isUnderBudget("exa")) {
    return "exa";
  }

  // Both over budget — still prefer Serper (cheaper)
  if (isSerperAvailable()) {
    return "serper";
  }

  return "exa";
}

/**
 * Check if Exa fallback is allowed (under daily budget).
 * Used by the search route before triggering an Exa fallback.
 */
export function isExaFallbackAllowed(): boolean {
  return isExaAvailable() && isUnderBudget("exa");
}

// ---------------------------------------------------------------------------
// Usage summary (for response metadata / debugging)
// ---------------------------------------------------------------------------

export interface DailyUsage {
  count: number;
  budget: number;
  pctUsed: number;
}

export function getUsageSummary(): Record<string, DailyUsage> {
  const result: Record<string, DailyUsage> = {};
  for (const source of ["exa", "parallel", "serper"]) {
    const count = getCount(source);
    const budget = DAILY_BUDGET[source] ?? 0;
    result[source] = {
      count,
      budget,
      pctUsed: budget > 0 ? Math.round((count / budget) * 100) : 0,
    };
  }
  return result;
}
