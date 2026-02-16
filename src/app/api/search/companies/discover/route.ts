import { NextResponse } from "next/server";
import { reformulateQueryWithEntities, looksLikeCompanyName, stripLegalSuffix, simplifyQuery } from "@/lib/navigator/exa/queryBuilder";
import { searchExa, isExaAvailable } from "@/lib/navigator/providers/exa";
import { searchSerper, isSerperAvailable } from "@/lib/navigator/providers/serper";
import { searchParallel, isParallelAvailable } from "@/lib/navigator/providers/parallel";
import { createServerClient } from "@/lib/supabase/server";
import { getCached, setCached, getRootDomain } from "@/lib/cache";
import { pickDiscoveryEngine, pickNameEngine, recordUsage, isExaFallbackAllowed } from "@/lib/navigator/routing/smartRouter";
import { CACHE_TTLS } from "@/lib/navigator/cache-config";
import { recordSuccess as cbSuccess, recordFailure as cbFailure } from "@/lib/navigator/circuitBreaker";
import { classifyError } from "@/lib/navigator/errors";
import type { SearchErrorDetail } from "@/lib/navigator/errors";
import type { Company, FilterState } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Exclusion filter (shared logic — duplicated for route isolation)
// ---------------------------------------------------------------------------

async function getExcludedValues(): Promise<Set<string>> {
  try {
    const cached = await getCached<string[]>("exclusions:all");
    if (cached) return new Set(cached);
    const supabase = createServerClient();
    const { data } = await supabase.from("exclusions").select("type, value");
    if (!data) return new Set();
    const valuesArray = data.map((row) => String(row.value).toLowerCase());
    await setCached("exclusions:all", valuesArray, CACHE_TTLS.exclusions);
    return new Set(valuesArray);
  } catch {
    return new Set();
  }
}

function applyExclusionFilter(companies: Company[], excluded: Set<string>): Company[] {
  if (excluded.size === 0) return companies;
  return companies.filter((c) => {
    const domainLower = c.domain.toLowerCase();
    const nameLower = c.name.toLowerCase();
    return !excluded.has(domainLower) && !excluded.has(nameLower);
  });
}

// ---------------------------------------------------------------------------
// POST handler — fast discovery phase (no Apollo enrichment, no NL ICP)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: { filters?: FilterState; freeText?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const filters = body.filters;
  const freeText = body.freeText;

  if (!filters && !freeText) {
    return NextResponse.json({ companies: [], extractedEntities: null, searchEngine: "none", excludedCount: 0, warnings: [] });
  }

  const errors: SearchErrorDetail[] = [];
  const warnings: string[] = [];
  let querySimplified = false;
  let didYouMean: { original: string; simplified: string } | null = null;

  const defaultFilters: FilterState = {
    sources: [], verticals: [], regions: [], sizes: [], signals: [], statuses: [],
    hideExcluded: true, quickFilters: [],
  };

  const isNameQuery = looksLikeCompanyName(freeText || "");
  let reformulatedQueries: string[];
  let extractedEntities: { verticals: string[]; regions: string[]; signals: string[] };

  if (isNameQuery && freeText?.trim()) {
    reformulatedQueries = [freeText.trim()];
    extractedEntities = { verticals: [], regions: [], signals: [] };
  } else {
    const reformulated = await reformulateQueryWithEntities(freeText || "", filters || defaultFilters);
    reformulatedQueries = reformulated.queries;
    extractedEntities = reformulated.entities;
  }

  const anyEngineAvailable = isExaAvailable() || isSerperAvailable() || isParallelAvailable();
  if (!anyEngineAvailable) {
    return NextResponse.json({ companies: [], extractedEntities, searchEngine: "none", excludedCount: 0, warnings: ["No search engine configured."] }, { status: 503 });
  }

  let searchEngine = "exa";

  try {
    const primaryQuery = reformulatedQueries[0] || freeText || "";
    const strippedQuery = stripLegalSuffix(primaryQuery);
    const numResults = isNameQuery ? 15 : 25;

    let searchCompanies: Company[] = [];
    let searchCacheHit = false;
    const excludedPromise = filters?.hideExcluded !== false ? getExcludedValues() : Promise.resolve(new Set<string>());

    if (isNameQuery) {
      searchEngine = await pickNameEngine();
      if (searchEngine === "serper") {
        try {
          const serperResult = await searchSerper(strippedQuery, numResults);
          searchCompanies = serperResult.companies;
          searchCacheHit = serperResult.cacheHit ?? false;
          if (!searchCacheHit) recordUsage("serper");
          cbSuccess("serper");
        } catch (err) {
          cbFailure("serper");
          errors.push(classifyError(err, "serper"));
        }
        if (searchCompanies.length === 0 && isExaFallbackAllowed()) {
          searchEngine = "exa";
          try {
            const exaResult = await searchExa({ query: strippedQuery, numResults });
            searchCompanies = exaResult.companies;
            searchCacheHit = exaResult.cacheHit ?? false;
            if (!searchCacheHit) recordUsage("exa");
            cbSuccess("exa");
          } catch (err) {
            cbFailure("exa");
            errors.push(classifyError(err, "exa"));
          }
        }
      } else {
        try {
          const exaResult = await searchExa({ query: strippedQuery, numResults });
          searchCompanies = exaResult.companies;
          searchCacheHit = exaResult.cacheHit ?? false;
          if (!searchCacheHit) recordUsage("exa");
          cbSuccess("exa");
        } catch (err) {
          cbFailure("exa");
          errors.push(classifyError(err, "exa"));
        }
      }
    } else {
      searchEngine = await pickDiscoveryEngine();
      if (searchEngine === "parallel") {
        try {
          const parallelResult = await searchParallel(strippedQuery, numResults);
          searchCompanies = parallelResult.companies;
          searchCacheHit = parallelResult.cacheHit ?? false;
          if (!searchCacheHit) recordUsage("parallel");
          cbSuccess("parallel");
          if (parallelResult.companies.length < 3 && parallelResult.avgRelevance < 0.2 && isExaFallbackAllowed()) {
            searchEngine = "exa";
            try {
              const exaResult = await searchExa({ query: strippedQuery, numResults });
              searchCompanies = exaResult.companies;
              searchCacheHit = exaResult.cacheHit ?? false;
              if (!searchCacheHit) recordUsage("exa");
              cbSuccess("exa");
            } catch (exaErr) {
              cbFailure("exa");
              errors.push(classifyError(exaErr, "exa"));
            }
          }
        } catch (err) {
          cbFailure("parallel");
          errors.push(classifyError(err, "parallel"));
          if (isExaFallbackAllowed()) {
            searchEngine = "exa";
            try {
              const exaResult = await searchExa({ query: strippedQuery, numResults });
              searchCompanies = exaResult.companies;
              searchCacheHit = exaResult.cacheHit ?? false;
              if (!searchCacheHit) recordUsage("exa");
              cbSuccess("exa");
            } catch (exaErr) {
              cbFailure("exa");
              errors.push(classifyError(exaErr, "exa"));
            }
          }
        }
      } else {
        try {
          const exaResult = await searchExa({ query: strippedQuery, numResults });
          searchCompanies = exaResult.companies;
          searchCacheHit = exaResult.cacheHit ?? false;
          if (!searchCacheHit) recordUsage("exa");
          cbSuccess("exa");
        } catch (err) {
          cbFailure("exa");
          errors.push(classifyError(err, "exa"));
        }
      }
    }

    // Auto-rephrase on empty results
    if (searchCompanies.length === 0 && freeText) {
      const simplified = simplifyQuery(freeText);
      if (simplified !== freeText.trim() && simplified.length > 0) {
        try {
          if (searchEngine === "parallel" && isParallelAvailable()) {
            const retryResult = await searchParallel(simplified, numResults);
            searchCompanies = retryResult.companies;
          } else if (isExaAvailable()) {
            const retryResult = await searchExa({ query: simplified, numResults });
            searchCompanies = retryResult.companies;
          } else if (isSerperAvailable()) {
            const retryResult = await searchSerper(simplified, numResults);
            searchCompanies = retryResult.companies;
          }
          if (searchCompanies.length > 0) {
            querySimplified = true;
            didYouMean = { original: freeText, simplified };
            warnings.push(`No exact results for "${freeText}". Showing results for: "${simplified}"`);
          }
        } catch {
          // Simplified retry also failed
        }
      }
    }

    const excluded = await excludedPromise;
    const filteredResults = applyExclusionFilter(searchCompanies, excluded);
    const excludedCount = searchCompanies.length - filteredResults.length;
    const companies = filteredResults.slice(0, 25);

    // Deduplicate by root domain
    const seenRoots = new Map<string, number>();
    const deduped: Company[] = [];
    for (const c of companies) {
      const root = getRootDomain(c.domain);
      const existing = seenRoots.get(root);
      if (existing !== undefined) {
        if (c.employeeCount > deduped[existing].employeeCount) {
          deduped[existing] = c;
        }
      } else {
        seenRoots.set(root, deduped.length);
        deduped.push(c);
      }
    }

    // Exact match detection
    const queryLower = (freeText || "").toLowerCase().trim();
    const strippedQueryLower = stripLegalSuffix(queryLower);
    if (strippedQueryLower) {
      for (const c of deduped) {
        if (c.exactMatch) continue;
        const domainBase = c.domain.replace(/\.(com|io|org|net|co|ai|de|it|eu)$/i, "").toLowerCase();
        const nameLower = c.name.toLowerCase();
        const strippedName = stripLegalSuffix(nameLower);
        if (
          domainBase === strippedQueryLower ||
          strippedName === strippedQueryLower ||
          domainBase.includes(strippedQueryLower.replace(/\s+/g, "")) ||
          strippedName.includes(strippedQueryLower) ||
          strippedName.startsWith(strippedQueryLower) ||
          strippedQueryLower.startsWith(strippedName)
        ) {
          c.exactMatch = true;
          break;
        }
      }
    }

    return NextResponse.json({
      companies: deduped,
      extractedEntities,
      searchEngine,
      excludedCount,
      errors,
      warnings,
      querySimplified,
      didYouMean,
      searchMeta: { totalDurationMs: 0, engineUsed: searchEngine, enrichedCount: 0, unenrichedCount: deduped.length },
    });
  } catch (err) {
    console.error("[Discover] search failed:", err);
    const fatalError = classifyError(err, searchEngine);
    return NextResponse.json({
      companies: [],
      extractedEntities: { verticals: [], regions: [], signals: [] },
      searchEngine,
      excludedCount: 0,
      errors: [fatalError],
      warnings: [],
      didYouMean: null,
      searchMeta: { totalDurationMs: 0, engineUsed: searchEngine, enrichedCount: 0, unenrichedCount: 0 },
    }, { status: 500 });
  }
}
