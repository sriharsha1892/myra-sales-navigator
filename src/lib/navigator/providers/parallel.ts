import type { Company, Signal } from "../types";
import { getCached, setCached, CacheKeys, CacheTTL, hashFilters, getRootDomain } from "@/lib/cache";
import { isNoiseDomain } from "./exa";
import { apiCallBreadcrumb } from "@/lib/sentry";
import { logApiCall } from "../health";
import { withTimeout } from "../timeout";

// ---------------------------------------------------------------------------
// Parallel AI Search Provider — alternative discovery engine
// ---------------------------------------------------------------------------

const PARALLEL_API_URL = "https://api.parallel.ai/v1beta/search";

export function isParallelAvailable(): boolean {
  return !!process.env.PARALLEL_API_KEY;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParallelResult {
  url: string;
  title?: string;
  publish_date?: string;
  excerpts?: string[];
}

interface ParallelResponse {
  search_id?: string;
  results?: ParallelResult[];
  warnings?: string[];
}

export interface ParallelSearchResult {
  companies: Company[];
  signals: Signal[];
  cacheHit?: boolean;
  avgRelevance: number;
}

// ---------------------------------------------------------------------------
// Domain extraction
// ---------------------------------------------------------------------------

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Map Parallel result → Company
// ---------------------------------------------------------------------------

function mapParallelResultToCompany(result: ParallelResult): Company {
  const domain = extractDomain(result.url);
  const name = result.title || domain;
  const description = result.excerpts?.join(" ").slice(0, 500) || "";
  const now = new Date().toISOString();

  return {
    domain,
    name,
    firstViewedBy: "system",
    firstViewedAt: now,
    lastViewedBy: "system",
    lastViewedAt: now,
    source: "parallel",
    noteCount: 0,
    lastNoteAt: null,
    extractionCount: 0,
    lastExtractionAt: null,
    excluded: false,
    excludedBy: null,
    excludedAt: null,
    exclusionReason: null,
    status: "new",
    statusChangedBy: null,
    statusChangedAt: null,
    viewedBy: null,
    industry: "",
    vertical: "",
    employeeCount: 0,
    location: "",
    region: "",
    description,
    icpScore: 0,
    hubspotStatus: "none",
    freshsalesStatus: "none",
    freshsalesIntel: null,
    sources: ["parallel"],
    signals: [],
    contactCount: 0,
    lastRefreshed: now,
    website: result.url,
  };
}

// ---------------------------------------------------------------------------
// searchParallel — discovery search via Parallel AI
// ---------------------------------------------------------------------------

export async function searchParallel(
  query: string,
  numResults?: number
): Promise<ParallelSearchResult> {
  if (!isParallelAvailable()) {
    return { companies: [], signals: [], avgRelevance: 0 };
  }

  const num = numResults ?? 25;

  // Check cache first
  const cacheKey = CacheKeys.parallelSearch(hashFilters({ query, num }));
  const cached = await getCached<ParallelSearchResult>(cacheKey);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  apiCallBreadcrumb("parallel", "search", { query: query.slice(0, 60), num });
  const searchStart = Date.now();

  const res = await withTimeout(
    (signal) =>
      fetch(PARALLEL_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": process.env.PARALLEL_API_KEY!,
          "Content-Type": "application/json",
          "parallel-beta": "search-extract-2025-10-10",
        },
        body: JSON.stringify({
          objective: `Find companies matching: ${query}. Focus on company websites, not news articles or directories.`,
          search_queries: [query],
          max_results: num + 10, // over-fetch to compensate for noise filtering
          excerpts: { max_chars_per_result: 2000 },
        }),
        signal,
      }),
    4000,
    "Parallel",
  );

  const latencyMs = Date.now() - searchStart;

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    logApiCall({
      source: "parallel", endpoint: "search", status_code: res.status, success: false,
      latency_ms: latencyMs, rate_limit_remaining: null,
      error_message: errText.slice(0, 200), context: { query: query.slice(0, 60) }, user_name: null,
    });
    console.warn("[Parallel] Search failed:", res.status, errText.slice(0, 200));
    return { companies: [], signals: [], avgRelevance: 0 };
  }

  const data: ParallelResponse = await res.json();

  apiCallBreadcrumb("parallel", "search complete", {
    results: data.results?.length ?? 0,
    searchId: data.search_id,
    latencyMs,
  });
  logApiCall({
    source: "parallel", endpoint: "search", status_code: 200, success: true,
    latency_ms: latencyMs, rate_limit_remaining: null,
    error_message: null, context: { query: query.slice(0, 60) }, user_name: null,
  });

  // Map + filter noise domains
  const companies = (data.results ?? [])
    .map(mapParallelResultToCompany)
    .filter((c) => !isNoiseDomain(c.domain));

  // Dedupe by root domain
  const seen = new Set<string>();
  const deduped = companies.filter((c) => {
    const root = getRootDomain(c.domain);
    if (seen.has(root)) return false;
    seen.add(root);
    return true;
  }).slice(0, num);

  // Assign position-based relevance scores (first result 1.0, last ~0.5)
  for (let i = 0; i < deduped.length; i++) {
    deduped[i].searchRelevanceScore = Math.round((1.0 - (i / Math.max(deduped.length, 1)) * 0.5) * 100) / 100;
  }

  // Parallel doesn't return relevance scores — use result count as quality signal
  const avgRelevance = deduped.length >= 3 ? 0.5 : deduped.length > 0 ? 0.2 : 0;

  // Extract signals from excerpts via LLM (if results have meaningful excerpts)
  const signals: Signal[] = [];

  const result: ParallelSearchResult = {
    companies: deduped,
    signals,
    cacheHit: false,
    avgRelevance,
  };

  await setCached(cacheKey, result, CacheTTL.parallelSearch).catch(() => {});

  return result;
}
