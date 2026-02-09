import Exa from "exa-js";
import type { Company, Signal, SignalType } from "../types";
import { completeJSON, isGroqAvailable } from "../llm/client";
import { getCached, setCached, CacheKeys, CacheTTL, hashFilters, getRootDomain } from "@/lib/cache";
import { apiCallBreadcrumb } from "@/lib/sentry";
import { logApiCall } from "../health";

/** Minimum Exa relevance score (0-1) to include a result. Filters garbage. */
const MIN_EXA_RELEVANCE = 0.10;

// ---------------------------------------------------------------------------
// Exa Client Singleton
// ---------------------------------------------------------------------------

let _exa: Exa | null = null;

function getExaClient(): Exa {
  if (!_exa) {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) throw new Error("EXA_API_KEY not configured");
    _exa = new Exa(apiKey);
  }
  return _exa;
}

export function isExaAvailable(): boolean {
  return !!process.env.EXA_API_KEY;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExaSearchParams {
  query: string;
  numResults?: number;
}

export interface ExaSearchResult {
  companies: Company[];
  signals: Signal[];
  cacheHit?: boolean;
}

// ---------------------------------------------------------------------------
// Noise domain blocklist — social media, aggregators, directories
// ---------------------------------------------------------------------------

const NOISE_DOMAINS = [
  "linkedin.com", "facebook.com", "twitter.com", "x.com",
  "instagram.com", "youtube.com", "tiktok.com",
  "crunchbase.com", "zoominfo.com", "glassdoor.com",
  "indeed.com", "bloomberg.com", "reuters.com",
  "wikipedia.org", "reddit.com", "medium.com",
  "github.com", "g2.com", "trustpilot.com",
  "yelp.com", "bbb.org", "dnb.com",
];

export function isNoiseDomain(domain: string): boolean {
  return NOISE_DOMAINS.some(nd => domain === nd || domain.endsWith(`.${nd}`));
}

// ---------------------------------------------------------------------------
// Domain extraction helper
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
// Map Exa result → Company
// ---------------------------------------------------------------------------

function mapExaResultToCompany(result: {
  url: string;
  title?: string | null;
  author?: string | null;
  publishedDate?: string | null;
  highlights?: string[];
  score?: number;
}): Company {
  const domain = extractDomain(result.url);
  const name = result.title || domain;
  const description = result.highlights?.join(" ") || "";
  const now = new Date().toISOString();

  return {
    // Anchor fields (defaults for search results)
    domain,
    name,
    firstViewedBy: "system",
    firstViewedAt: now,
    lastViewedBy: "system",
    lastViewedAt: now,
    source: "exa",
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

    // Enrichment fields (partial — filled further by Apollo/HubSpot later)
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
    sources: ["exa"],
    signals: [],
    contactCount: 0,
    lastRefreshed: now,
    website: result.url,
    exaRelevanceScore: result.score ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// searchExa — company + news search in parallel
// ---------------------------------------------------------------------------

export async function searchExa(
  params: ExaSearchParams
): Promise<ExaSearchResult> {
  if (!isExaAvailable()) {
    return { companies: [], signals: [] };
  }

  // Check cache first (6h TTL)
  const cacheKey = CacheKeys.exaSearch(hashFilters({ query: params.query, numResults: params.numResults ?? 25 }));
  const cached = await getCached<ExaSearchResult>(cacheKey);
  if (cached) {
    console.log("[Exa] Returning cached search results for:", params.query.slice(0, 60));
    return { ...cached, cacheHit: true };
  }

  const exa = getExaClient();
  const numResults = params.numResults ?? 25;

  apiCallBreadcrumb("exa", "search", { query: params.query.slice(0, 60), numResults });
  const searchStart = Date.now();

  const [companyResults, newsResults] = await Promise.all([
    // Company search — category:"company" uses a dedicated index that
    // does not support excludeDomains, so we post-filter noise domains instead
    exa.search(params.query, {
      type: "auto",
      numResults: numResults + 10, // over-fetch to compensate for post-filtering
      category: "company" as never,
      contents: {
        highlights: {
          numSentences: 6,
          highlightsPerUrl: 6,
        },
      },
      ...({ language: "en" } as Record<string, unknown>),
    }),
    // News/signals search
    exa.search(params.query, {
      type: "auto",
      numResults: 10,
      category: "news" as never,
      contents: {
        highlights: {
          numSentences: 4,
          highlightsPerUrl: 4,
        },
      },
      ...({ language: "en" } as Record<string, unknown>),
    }),
  ]);

  apiCallBreadcrumb("exa", "search complete", {
    companies: companyResults.results.length,
    news: newsResults.results.length,
    latencyMs: Date.now() - searchStart,
  });
  logApiCall({
    source: "exa", endpoint: "search", status_code: 200, success: true,
    latency_ms: Date.now() - searchStart, rate_limit_remaining: null,
    error_message: null, context: { query: params.query.slice(0, 60) }, user_name: null,
  });

  // Map company results, capture Exa relevance scores, filter noise + low-relevance
  const companies = companyResults.results
    .map(mapExaResultToCompany)
    .filter(c => !isNoiseDomain(c.domain))
    .filter(c => (c.exaRelevanceScore ?? 1) >= MIN_EXA_RELEVANCE);

  // Dedupe by root domain (consistent with route-level dedup in cache.ts)
  const seen = new Set<string>();
  const dedupedCompanies = companies.filter((c) => {
    const root = getRootDomain(c.domain);
    if (seen.has(root)) return false;
    seen.add(root);
    return true;
  });

  // Extract signals from news results via LLM
  let signals: Signal[] = [];
  if (newsResults.results.length > 0) {
    const newsContent = newsResults.results
      .map((r) => {
        const highlights = (r as { highlights?: string[] }).highlights?.join(" ") || "";
        return `[${r.title}] (${r.url})\n${highlights}`;
      })
      .join("\n\n");

    signals = await extractSignals(newsContent, params.query);

    // Attach source URLs from news results to matching signals
    for (const signal of signals) {
      const match = newsResults.results.find(
        (r) => r.title && signal.title && signal.title.toLowerCase().includes(r.title.toLowerCase().slice(0, 20))
      );
      if (match) {
        signal.sourceUrl = match.url;
      }
    }
  }

  const result: ExaSearchResult = { companies: dedupedCompanies, signals, cacheHit: false };

  // Cache for 6 hours
  await setCached(cacheKey, result, CacheTTL.exaSearch).catch(() => {});

  return result;
}

// ---------------------------------------------------------------------------
// LLM Signal Extraction (Groq → Gemini fallback)
// ---------------------------------------------------------------------------

const SIGNAL_EXTRACTION_PROMPT = `You are a B2B signal extraction engine. Parse the following web content about a company and extract structured signals.

For each signal found, identify:
- type: one of "hiring", "funding", "expansion", "news"
- title: short headline (max 80 chars)
- description: 1-2 sentence summary
- date: ISO date if mentioned, or "unknown"

Only extract signals that are actionable for B2B sales outreach. Skip generic marketing content.
All output MUST be in English. If the source content is in another language, translate to English.

Return JSON: { "signals": [{ "type": "...", "title": "...", "description": "...", "date": "..." }] }

Company domain: {domain}
Content:
{content}`;

interface ExtractedSignal {
  type: string;
  title: string;
  description: string;
  date: string;
}

const VALID_SIGNAL_TYPES: SignalType[] = ["hiring", "funding", "expansion", "news"];

/**
 * Extracts structured Signal objects from raw Exa web content using LLM.
 * Uses Groq with Gemini fallback for JSON validation failures.
 * Falls back to empty array if both providers fail.
 */
export async function extractSignals(
  content: string,
  companyDomain: string
): Promise<Signal[]> {
  if (!isGroqAvailable() || !content.trim()) {
    return [];
  }

  try {
    const prompt = SIGNAL_EXTRACTION_PROMPT
      .replace("{domain}", companyDomain)
      .replace("{content}", content.slice(0, 4000)); // Limit context window

    const result = await completeJSON<{ signals: ExtractedSignal[] }>(
      prompt,
      (data) => {
        const obj = data as { signals?: unknown[] };
        if (!Array.isArray(obj?.signals)) throw new Error("Expected signals array");
        return { signals: obj.signals as ExtractedSignal[] };
      },
      { maxTokens: 1024 }
    );

    return result.signals
      .filter((s) => VALID_SIGNAL_TYPES.includes(s.type as SignalType))
      .map((s, i) => ({
        id: `signal-${companyDomain}-${i}-${Date.now()}`,
        companyDomain,
        type: s.type as SignalType,
        title: s.title || "Untitled signal",
        description: s.description || "",
        date: s.date !== "unknown" ? s.date : new Date().toISOString(),
        sourceUrl: null,
        source: "exa" as const,
      }));
  } catch (err) {
    console.warn("[Exa] Signal extraction failed, returning empty:", err);
    return [];
  }
}
