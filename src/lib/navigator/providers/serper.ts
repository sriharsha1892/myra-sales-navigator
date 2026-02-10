import type { Company, Signal } from "../types";
import { getCached, setCached, CacheKeys, CacheTTL, hashFilters, getRootDomain } from "@/lib/cache";
import { isNoiseDomain } from "./exa";
import { apiCallBreadcrumb } from "@/lib/sentry";
import { logApiCall } from "../health";
import { withRetry, HttpError } from "../retry";

// ---------------------------------------------------------------------------
// Serper (Google Search) Provider — used for company-name queries
// ---------------------------------------------------------------------------

const SERPER_API_URL = "https://google.serper.dev/search";

export function isSerperAvailable(): boolean {
  return !!process.env.SERPER_API_KEY;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperKnowledgeGraph {
  title?: string;
  description?: string;
  website?: string;
  type?: string;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  knowledgeGraph?: SerperKnowledgeGraph;
  searchParameters?: { q: string };
}

export interface SerperSearchResult {
  companies: Company[];
  signals: Signal[];
  cacheHit?: boolean;
  knowledgeGraph?: SerperKnowledgeGraph;
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

/**
 * Clean title strings from Serper — strip common suffixes like
 * " - Wikipedia", " | LinkedIn", " - Crunchbase", etc.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-–|]\s*(Wikipedia|LinkedIn|Crunchbase|Bloomberg|Reuters|Glassdoor|ZoomInfo|G2|Forbes|Yahoo Finance).*$/i, "")
    .replace(/\s*\(.*?\)\s*$/, "") // strip trailing parenthetical
    .trim();
}

// ---------------------------------------------------------------------------
// Map Serper result → Company
// ---------------------------------------------------------------------------

function mapSerperResultToCompany(result: SerperOrganicResult): Company {
  const domain = extractDomain(result.link);
  const name = cleanTitle(result.title);
  const now = new Date().toISOString();

  return {
    domain,
    name,
    firstViewedBy: "system",
    firstViewedAt: now,
    lastViewedBy: "system",
    lastViewedAt: now,
    source: "serper",
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
    description: result.snippet || "",
    icpScore: 0,
    hubspotStatus: "none",
    freshsalesStatus: "none",
    freshsalesIntel: null,
    sources: ["serper"],
    signals: [],
    contactCount: 0,
    lastRefreshed: now,
    website: result.link,
  };
}

// ---------------------------------------------------------------------------
// searchSerper — Google search via Serper API
// ---------------------------------------------------------------------------

export async function searchSerper(
  query: string,
  numResults?: number
): Promise<SerperSearchResult> {
  if (!isSerperAvailable()) {
    return { companies: [], signals: [] };
  }

  const num = numResults ?? 10;

  // Check cache first
  const cacheKey = CacheKeys.serperSearch(hashFilters({ query, num }));
  const cached = await getCached<SerperSearchResult>(cacheKey);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  apiCallBreadcrumb("serper", "search", { query: query.slice(0, 60), num });
  const searchStart = Date.now();

  let res: Response;
  try {
    res = await withRetry(
      async () => {
        const r = await fetch(SERPER_API_URL, {
          method: "POST",
          headers: {
            "X-API-KEY": process.env.SERPER_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: query, num }),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Serper", maxRetries: 2 }
    );
  } catch (err) {
    const latencyMs = Date.now() - searchStart;
    const status = err instanceof HttpError ? err.status : 0;
    const errMsg = err instanceof Error ? err.message : String(err);
    logApiCall({
      source: "serper", endpoint: "search", status_code: status, success: false,
      latency_ms: latencyMs, rate_limit_remaining: null,
      error_message: errMsg.slice(0, 200), context: { query: query.slice(0, 60) }, user_name: null,
    });
    console.warn("[Serper] Search failed:", errMsg);
    return { companies: [], signals: [] };
  }

  const latencyMs = Date.now() - searchStart;
  const data: SerperResponse = await res.json();

  apiCallBreadcrumb("serper", "search complete", {
    organic: data.organic?.length ?? 0,
    hasKg: !!data.knowledgeGraph,
    latencyMs,
  });
  logApiCall({
    source: "serper", endpoint: "search", status_code: 200, success: true,
    latency_ms: latencyMs, rate_limit_remaining: null,
    error_message: null, context: { query: query.slice(0, 60) }, user_name: null,
  });

  // Map organic results
  const companies = (data.organic ?? [])
    .map(mapSerperResultToCompany)
    .filter((c) => !isNoiseDomain(c.domain));

  // If knowledge graph has a website, ensure it's at the front with high priority
  if (data.knowledgeGraph?.website) {
    const kgDomain = extractDomain(data.knowledgeGraph.website);
    if (!isNoiseDomain(kgDomain)) {
      const existing = companies.find((c) => getRootDomain(c.domain) === getRootDomain(kgDomain));
      if (existing) {
        // Enrich existing entry with KG data
        existing.name = data.knowledgeGraph.title || existing.name;
        existing.description = data.knowledgeGraph.description || existing.description;
        existing.exactMatch = true;
      } else {
        // Create a new entry from KG
        const now = new Date().toISOString();
        companies.unshift({
          domain: kgDomain,
          name: data.knowledgeGraph.title || kgDomain,
          firstViewedBy: "system",
          firstViewedAt: now,
          lastViewedBy: "system",
          lastViewedAt: now,
          source: "serper",
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
          description: data.knowledgeGraph.description || "",
          icpScore: 0,
          hubspotStatus: "none",
          freshsalesStatus: "none",
          freshsalesIntel: null,
          sources: ["serper"],
          signals: [],
          contactCount: 0,
          lastRefreshed: now,
          website: data.knowledgeGraph.website,
          exactMatch: true,
        });
      }
    }
  }

  // Dedupe by root domain
  const seen = new Set<string>();
  const deduped = companies.filter((c) => {
    const root = getRootDomain(c.domain);
    if (seen.has(root)) return false;
    seen.add(root);
    return true;
  });

  const result: SerperSearchResult = {
    companies: deduped,
    signals: [], // Serper doesn't extract signals — Apollo/Exa handle that
    cacheHit: false,
    knowledgeGraph: data.knowledgeGraph,
  };

  await setCached(cacheKey, result, CacheTTL.serperSearch).catch(() => {});

  return result;
}
