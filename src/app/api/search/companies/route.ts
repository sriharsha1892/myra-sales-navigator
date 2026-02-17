import { NextResponse } from "next/server";
import { reformulateQueryWithEntities, looksLikeCompanyName, stripLegalSuffix, simplifyQuery } from "@/lib/navigator/exa/queryBuilder";
import { searchExa, isExaAvailable } from "@/lib/navigator/providers/exa";
import { searchSerper, isSerperAvailable } from "@/lib/navigator/providers/serper";
import { searchParallel, isParallelAvailable } from "@/lib/navigator/providers/parallel";
import {
  isApolloAvailable,
  enrichCompany,
  findContacts,
} from "@/lib/navigator/providers/apollo";
import { createServerClient } from "@/lib/supabase/server";
import { calculateIcpScore } from "@/lib/navigator/scoring";
import { getCached, setCached, getRootDomain } from "@/lib/cache";
import { extractICPCriteria, scoreCompaniesAgainstICP } from "@/lib/navigator/llm/icpPrompts";
import { pickDiscoveryEngine, pickNameEngine, recordUsage, isExaFallbackAllowed, getUsageSummary } from "@/lib/navigator/routing/smartRouter";
import { CACHE_TTLS } from "@/lib/navigator/cache-config";
import { trackUsageEventServer } from "@/lib/navigator/analytics-server";
import { recordSuccess as cbSuccess, recordFailure as cbFailure } from "@/lib/navigator/circuitBreaker";
import { classifyError } from "@/lib/navigator/errors";
import type { SearchErrorDetail } from "@/lib/navigator/errors";
import type { Company, FilterState, IcpWeights, NLICPCriteria, FreshsalesSettings } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Apollo structured search — enrich Exa domains + find contacts in parallel
// Returns enriched companies (Apollo firmographics merged onto Exa shells)
// ---------------------------------------------------------------------------

async function getEnrichmentLimits(): Promise<{ maxSearchEnrich: number; maxContactAutoEnrich: number; maxClearoutFinds: number }> {
  const defaults = { maxSearchEnrich: 15, maxContactAutoEnrich: 5, maxClearoutFinds: 10 };
  try {
    const cached = await getCached<typeof defaults>("admin:enrichment-limits");
    if (cached) return cached;
    const supabase = createServerClient();
    const { data } = await supabase
      .from("admin_config")
      .select("enrichment_limits")
      .eq("id", "global")
      .single();
    if (data?.enrichment_limits) {
      const limits = { ...defaults, ...(data.enrichment_limits as Record<string, number>) };
      await setCached("admin:enrichment-limits", limits, CACHE_TTLS.adminConfig);
      return limits;
    }
  } catch { /* use defaults */ }
  return defaults;
}

async function apolloStructuredSearch(
  exaCompanies: Company[],
  maxEnrich?: number
): Promise<Company[]> {
  if (!isApolloAvailable() || exaCompanies.length === 0) return [];

  const limit = maxEnrich ?? 10;
  // Pick up to `limit` unique domains from Exa results for Apollo enrichment (Smart Enrich)
  const domains = [...new Set(exaCompanies.map((c) => c.domain))].slice(0, limit);

  const enriched = await Promise.allSettled(
    domains.map(async (domain) => {
      const [apolloData, contacts] = await Promise.all([
        enrichCompany(domain),
        findContacts(domain),
      ]);

      if (!apolloData) {
        if (contacts.length > 0) {
          const base = exaCompanies.find((c) => c.domain === domain);
          if (base) return { ...base, contactCount: contacts.length, sources: [...new Set([...base.sources, "apollo" as const])] };
        }
        return null;
      }

      // Find the original Exa company shell to merge onto
      const base = exaCompanies.find((c) => c.domain === domain);
      if (!base) return null;

      const merged: Company = {
        ...base,
        name: apolloData.name || base.name,
        industry: apolloData.industry || base.industry,
        employeeCount: apolloData.employeeCount || base.employeeCount,
        location: apolloData.location || base.location,
        region: apolloData.region || base.region,
        description: apolloData.description || base.description,
        website: apolloData.website || base.website,
        logoUrl: apolloData.logoUrl || base.logoUrl,
        revenue: apolloData.revenue || base.revenue,
        founded: apolloData.founded || base.founded,
        contactCount: contacts.length,
        sources: [...new Set([...base.sources, "apollo" as const])],
        lastRefreshed: new Date().toISOString(),
      };
      return merged;
    })
  );

  const results: Company[] = [];
  for (const r of enriched) {
    if (r.status === "fulfilled" && r.value !== null) {
      results.push(r.value);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Exclusion filter — pull domains/companies/emails from Supabase exclusions
// ---------------------------------------------------------------------------

async function getExcludedValues(): Promise<Set<string>> {
  try {
    // Check in-memory cache first (5 min TTL, busted on exclusion mutations)
    const cached = await getCached<string[]>("exclusions:all");
    if (cached) return new Set(cached);

    const supabase = createServerClient();
    const { data } = await supabase.from("exclusions").select("type, value");
    if (!data) return new Set();

    const valuesArray: string[] = [];
    for (const row of data) {
      // Normalize: lowercase for case-insensitive matching
      valuesArray.push(String(row.value).toLowerCase());
    }

    await setCached("exclusions:all", valuesArray, CACHE_TTLS.exclusions);
    return new Set(valuesArray);
  } catch {
    return new Set();
  }
}

function applyExclusionFilter(
  companies: Company[],
  excluded: Set<string>
): Company[] {
  if (excluded.size === 0) return companies;
  return companies.filter((c) => {
    const domainLower = c.domain.toLowerCase();
    const nameLower = c.name.toLowerCase();
    return !excluded.has(domainLower) && !excluded.has(nameLower);
  });
}

// ---------------------------------------------------------------------------
// Lightweight firmographic extraction from description text (Phase 4A)
// Used for companies that didn't get Apollo enrichment (positions 16-25)
// ---------------------------------------------------------------------------

function extractFirmographicsFromDescription(desc: string): { employeeCount?: number; location?: string } {
  const result: { employeeCount?: number; location?: string } = {};

  // Employee count from common patterns like "500 employees", "1,000+ team members"
  const empMatch = desc.match(/(\d[\d,]+)\+?\s*(?:employees|team members|people|staff|workers)/i);
  if (empMatch) {
    const num = parseInt(empMatch[1].replace(/,/g, ""), 10);
    if (num > 0 && num < 1_000_000) result.employeeCount = num;
  }

  // Location from patterns like "headquartered in Munich", "based in New York"
  const locMatch = desc.match(/(?:headquartered|based|located|offices?)\s+in\s+([^.,;]+)/i);
  if (locMatch) result.location = locMatch[1].trim().slice(0, 100);

  return result;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: { filters?: FilterState; freeText?: string; userName?: string; domains?: string[] };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const filters = body.filters;
  const freeText = body.freeText;

  // Phase 2 enrichment: caller passes pre-discovered domains
  const enrichOnlyDomains = body.domains;

  if (!filters && !freeText && !enrichOnlyDomains) {
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries: [],
      message: "No search criteria provided.",
    });
  }

  // Search deadline — ensure we complete within Vercel's 10s function timeout
  const SEARCH_DEADLINE_MS = 8500;
  const searchStart = Date.now();
  function remainingMs(): number {
    return Math.max(0, SEARCH_DEADLINE_MS - (Date.now() - searchStart));
  }

  // Performance tracking
  let reformulationMs = 0;
  let exaDurationMs = 0;
  let apolloDurationMs = 0;
  let nlIcpScoringMs = 0;
  let exaCacheHit = false;
  let exaResultCount = 0;
  let apolloEnrichedCount = 0;
  let highFitCount = 0;
  let exaError: string | null = null;
  let apolloError: string | null = null;
  let nlIcpError: string | null = null;

  // Structured error + warning accumulation (Phase 3)
  const errors: SearchErrorDetail[] = [];
  const warnings: string[] = [];
  let querySimplified = false;
  let didYouMean: { original: string; simplified: string } | null = null;

  // --- Enrich-only path: Phase 2 of two-phase search ---
  if (enrichOnlyDomains && enrichOnlyDomains.length > 0) {
    try {
      const enrichLimits = await getEnrichmentLimits();
      // Build minimal Company shells from domains (for Apollo enrichment input)
      const now = new Date().toISOString();
      const shells: Company[] = enrichOnlyDomains.map((domain) => ({
        domain,
        name: domain,
        firstViewedBy: "",
        firstViewedAt: now,
        lastViewedBy: "",
        lastViewedAt: now,
        source: "",
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
        description: "",
        icpScore: 0,
        hubspotStatus: "none" as const,
        freshsalesStatus: "none" as const,
        freshsalesIntel: null,
        sources: [],
        signals: [],
        contactCount: 0,
        lastRefreshed: now,
      }));

      // Try to load cached Exa data for each domain to get richer shells
      for (const shell of shells) {
        const cached = await getCached<Company>(`exa:company:${shell.domain}`);
        if (cached) {
          Object.assign(shell, cached);
        }
      }

      const apolloEnriched = await apolloStructuredSearch(shells, enrichLimits.maxSearchEnrich);
      apolloEnrichedCount = apolloEnriched.length;

      // Merge Apollo enrichment onto shells
      const enrichedDomains = new Set(apolloEnriched.map((c) => getRootDomain(c.domain)));
      const merged = shells.map((c) =>
        enrichedDomains.has(getRootDomain(c.domain))
          ? apolloEnriched.find((e) => getRootDomain(e.domain) === getRootDomain(c.domain))!
          : c
      );

      // ICP scoring — fetch admin weights + freshsales tag config
      let icpWeights: Partial<IcpWeights> = {};
      let fsSettings: Partial<FreshsalesSettings> | null = null;
      try {
        const cachedWeights = await getCached<IcpWeights>("admin:icp-weights");
        const cachedFs = await getCached<FreshsalesSettings>("admin:freshsales-settings");
        if (cachedWeights) {
          icpWeights = cachedWeights;
          fsSettings = cachedFs;
        } else {
          const supabase = createServerClient();
          const { data: configRow } = await supabase.from("admin_config").select("icp_weights, freshsales_settings").eq("id", "global").single();
          if (configRow?.icp_weights) {
            icpWeights = configRow.icp_weights as IcpWeights;
            await setCached("admin:icp-weights", icpWeights, CACHE_TTLS.adminConfig);
          }
          if (configRow?.freshsales_settings) {
            fsSettings = configRow.freshsales_settings as FreshsalesSettings;
            await setCached("admin:freshsales-settings", fsSettings, CACHE_TTLS.adminConfig);
          }
        }
      } catch { /* use defaults */ }

      const scoringContext = {
        verticals: filters?.verticals ?? [],
        regions: filters?.regions ?? [],
        sizes: filters?.sizes ?? [],
        signals: filters?.signals?.map(String) ?? [],
        tagScoringRules: fsSettings?.tagScoringRules,
        stalledDealThresholdDays: fsSettings?.stalledDealThresholdDays,
      };

      for (const c of merged) {
        const { score, breakdown } = calculateIcpScore(c, icpWeights, scoringContext);
        c.icpScore = score;
        c.icpBreakdown = breakdown;
      }

      // NL ICP scoring for discovery queries
      const isNameQuery = looksLikeCompanyName(freeText || "");
      let nlIcpCriteria: NLICPCriteria | null = null;
      if (!isNameQuery && freeText && remainingMs() >= 1500) {
        try {
          nlIcpCriteria = await extractICPCriteria(freeText);
          const nlScores = await scoreCompaniesAgainstICP(nlIcpCriteria, merged);
          const scoreMap = new Map(nlScores.map((s) => [s.domain, s]));
          for (const c of merged) {
            const nlScore = scoreMap.get(c.domain);
            if (nlScore) {
              c.nlIcpScore = nlScore.score;
              c.nlIcpReasoning = nlScore.reasoning;
              c.icpScore = nlScore.score;
            }
          }
        } catch { /* use rule-based scores */ }
      }

      merged.sort((a, b) => b.icpScore - a.icpScore);

      return NextResponse.json({
        companies: merged,
        signals: [],
        reformulatedQueries: [],
        extractedEntities: { verticals: [], regions: [], signals: [] },
        nlIcpCriteria,
        excludedCount: 0,
        searchEngine: "apollo",
        errors: [],
        warnings: [],
        searchMeta: {
          totalDurationMs: Date.now() - searchStart,
          engineUsed: "apollo",
          enrichedCount: apolloEnrichedCount,
          unenrichedCount: merged.length - apolloEnrichedCount,
        },
      });
    } catch (err) {
      console.error("[Search] enrich-only failed:", err);
      return NextResponse.json({
        companies: [],
        signals: [],
        reformulatedQueries: [],
        error: "Enrichment failed.",
        errors: [classifyError(err, "apollo")],
        warnings: [],
        searchMeta: { totalDurationMs: Date.now() - searchStart, engineUsed: "apollo", enrichedCount: 0, unenrichedCount: 0 },
      }, { status: 500 });
    }
  }

  // LLM query reformulation (Groq) — expands raw text into semantic queries.
  // Skip reformulation for company name queries to avoid genericizing them.
  const defaultFilters: FilterState = {
    sources: [],
    verticals: [],
    regions: [],
    sizes: [],
    signals: [],
    statuses: [],
    hideExcluded: true,
    quickFilters: [],
  };
  const isNameQuery = looksLikeCompanyName(freeText || "");
  let reformulatedQueries: string[];
  let extractedEntities: { verticals: string[]; regions: string[]; signals: string[] };

  const reformulationStart = Date.now();
  if (isNameQuery && freeText?.trim()) {
    // Company name → use exact text, skip LLM to avoid genericization
    reformulatedQueries = [freeText.trim()];
    extractedEntities = { verticals: [], regions: [], signals: [] };
  } else {
    const reformulated = await reformulateQueryWithEntities(
      freeText || "",
      filters || defaultFilters
    );
    reformulatedQueries = reformulated.queries;
    extractedEntities = reformulated.entities;
  }
  reformulationMs = Date.now() - reformulationStart;

  // Check that at least one search engine is available
  const anyEngineAvailable = isExaAvailable() || isSerperAvailable() || isParallelAvailable();
  if (!anyEngineAvailable) {
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries,
      message: "No search engine configured. Set EXA_API_KEY, SERPER_API_KEY, or PARALLEL_API_KEY.",
    }, { status: 503 });
  }

  let searchEngine = "exa"; // track which engine was used (for logging)

  try {
    const primaryQuery = reformulatedQueries[0] || freeText || "";
    const strippedQuery = stripLegalSuffix(primaryQuery);
    const numResults = isNameQuery ? 15 : 25;

    // ------ Smart Engine Dispatch (budget + health aware) ------
    // Parallel = workhorse (20K free). Serper = company names (2,500 free).
    // Exa = emergency fallback only ($10.38 remaining).
    let searchCompanies: Company[] = [];
    let searchSignals: import("@/lib/navigator/types").Signal[] = [];
    let searchCacheHit = false;

    const exaStart = Date.now();
    const excludedPromise = filters?.hideExcluded !== false ? getExcludedValues() : Promise.resolve(new Set<string>());

    if (isNameQuery) {
      // --- Company name path: smart router picks Serper or Exa ---
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
          exaError = err instanceof Error ? err.message : "Serper search failed";
          errors.push(classifyError(err, "serper"));
          console.warn("[SmartRouter] Serper failed:", err);
        }
        // Fallback to Exa only if Serper returned nothing AND Exa budget allows
        if (searchCompanies.length === 0 && isExaFallbackAllowed()) {
          searchEngine = "exa";
          try {
            const exaResult = await searchExa({ query: strippedQuery, numResults });
            searchCompanies = exaResult.companies;
            searchSignals = exaResult.signals;
            searchCacheHit = exaResult.cacheHit ?? false;
            if (!searchCacheHit) recordUsage("exa");
            cbSuccess("exa");
          } catch (err) {
            cbFailure("exa");
            exaError = err instanceof Error ? err.message : "Exa search failed";
            errors.push(classifyError(err, "exa"));
          }
        }
      } else {
        // Router picked Exa directly (Serper unavailable)
        try {
          const exaResult = await searchExa({ query: strippedQuery, numResults });
          searchCompanies = exaResult.companies;
          searchSignals = exaResult.signals;
          searchCacheHit = exaResult.cacheHit ?? false;
          if (!searchCacheHit) recordUsage("exa");
          cbSuccess("exa");
        } catch (err) {
          cbFailure("exa");
          exaError = err instanceof Error ? err.message : "Exa search failed";
          errors.push(classifyError(err, "exa"));
        }
      }
    } else {
      // --- Discovery path: smart router picks Parallel or Exa ---
      searchEngine = await pickDiscoveryEngine();

      if (searchEngine === "parallel") {
        try {
          const parallelResult = await searchParallel(strippedQuery, numResults);
          searchCompanies = parallelResult.companies;
          searchSignals = parallelResult.signals;
          searchCacheHit = parallelResult.cacheHit ?? false;
          if (!searchCacheHit) recordUsage("parallel");
          cbSuccess("parallel");
          // Fallback: Parallel returned too few results — try Exa IF budget allows
          if (parallelResult.companies.length < 3 && parallelResult.avgRelevance < 0.2 && isExaFallbackAllowed()) {
            searchEngine = "exa";
            try {
              const exaResult = await searchExa({ query: strippedQuery, numResults });
              searchCompanies = exaResult.companies;
              searchSignals = exaResult.signals;
              searchCacheHit = exaResult.cacheHit ?? false;
              if (!searchCacheHit) recordUsage("exa");
              cbSuccess("exa");
            } catch (exaFallbackErr) {
              cbFailure("exa");
              exaError = exaFallbackErr instanceof Error ? exaFallbackErr.message : "Exa fallback failed";
              errors.push(classifyError(exaFallbackErr, "exa"));
            }
          }
        } catch (err) {
          cbFailure("parallel");
          exaError = err instanceof Error ? err.message : "Parallel search failed";
          errors.push(classifyError(err, "parallel"));
          console.warn("[SmartRouter] Parallel failed:", err);
          // Fallback to Exa on error only if budget allows
          if (isExaFallbackAllowed()) {
            searchEngine = "exa";
            try {
              const exaResult = await searchExa({ query: strippedQuery, numResults });
              searchCompanies = exaResult.companies;
              searchSignals = exaResult.signals;
              searchCacheHit = exaResult.cacheHit ?? false;
              if (!searchCacheHit) recordUsage("exa");
              cbSuccess("exa");
            } catch (exaErr) {
              cbFailure("exa");
              exaError = exaErr instanceof Error ? exaErr.message : "Exa search failed";
              errors.push(classifyError(exaErr, "exa"));
            }
          }
        }
      } else {
        // Router picked Exa directly (Parallel unavailable)
        try {
          const exaResult = await searchExa({ query: strippedQuery, numResults });
          searchCompanies = exaResult.companies;
          searchSignals = exaResult.signals;
          searchCacheHit = exaResult.cacheHit ?? false;
          if (!searchCacheHit) recordUsage("exa");
          cbSuccess("exa");
        } catch (err) {
          cbFailure("exa");
          exaError = err instanceof Error ? err.message : "Exa search failed";
          errors.push(classifyError(err, "exa"));
        }
      }
    }

    // Phase 5A: Auto-rephrase on empty results (one attempt only)
    if (searchCompanies.length === 0 && freeText) {
      const simplified = simplifyQuery(freeText);
      if (simplified !== freeText.trim() && simplified.length > 0) {
        try {
          if (searchEngine === "parallel" && isParallelAvailable()) {
            const retryResult = await searchParallel(simplified, numResults);
            searchCompanies = retryResult.companies;
            searchSignals = retryResult.signals;
          } else if (isExaAvailable()) {
            const retryResult = await searchExa({ query: simplified, numResults });
            searchCompanies = retryResult.companies;
            searchSignals = retryResult.signals;
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
          // Simplified retry also failed — continue with empty results
        }
      }
    }

    const excluded = await excludedPromise;
    exaDurationMs = Date.now() - exaStart;
    exaCacheHit = searchCacheHit;
    exaResultCount = searchCompanies.length;

    // Apply exclusion filter
    const filteredResults = applyExclusionFilter(searchCompanies, excluded);
    const excludedCount = searchCompanies.length - filteredResults.length;
    const exaCompanies = filteredResults.slice(0, 25);

    // Apollo structured enrichment — runs in parallel on Exa domains
    // Smart Enrich: only top N by Exa relevance (admin-configurable, default 10)
    // Skip if less than 2s remaining on the search deadline
    const enrichLimits = await getEnrichmentLimits();
    const apolloStart = Date.now();
    let apolloEnriched: Company[] = [];
    if (remainingMs() < 2000) {
      console.warn("[Search] Skipping Apollo enrichment — deadline pressure (%dms left)", remainingMs());
    } else {
      try {
        apolloEnriched = await apolloStructuredSearch(exaCompanies, enrichLimits.maxSearchEnrich);
      } catch (err) {
        apolloError = err instanceof Error ? err.message : "Apollo enrichment failed";
        errors.push(classifyError(err, "apollo"));
        apolloEnriched = [];
      }
    }
    apolloDurationMs = Date.now() - apolloStart;
    apolloEnrichedCount = apolloEnriched.length;

    // Build final company list: Apollo-enriched where available, raw Exa otherwise
    const enrichedDomains = new Set(apolloEnriched.map((c) => getRootDomain(c.domain)));
    const merged = exaCompanies.map(
      (c) =>
        enrichedDomains.has(getRootDomain(c.domain))
          ? apolloEnriched.find((e) => getRootDomain(e.domain) === getRootDomain(c.domain))!
          : c
    );

    // Lightweight text-based firmographic extraction for unenriched companies (Phase 4A)
    let textExtractedCount = 0;
    for (const c of merged) {
      if (!enrichedDomains.has(getRootDomain(c.domain)) && c.description) {
        const extracted = extractFirmographicsFromDescription(c.description);
        if (extracted.employeeCount && !c.employeeCount) { c.employeeCount = extracted.employeeCount; textExtractedCount++; }
        if (extracted.location && !c.location) c.location = extracted.location;
      }
    }

    // Deduplicate by root domain — keep entry with highest employeeCount
    const seenRoots = new Map<string, number>();
    const companies: typeof merged = [];
    for (const c of merged) {
      const root = getRootDomain(c.domain);
      const existing = seenRoots.get(root);
      if (existing !== undefined) {
        // Replace if this one has more employees
        if (c.employeeCount > companies[existing].employeeCount) {
          companies[existing] = c;
        }
      } else {
        seenRoots.set(root, companies.length);
        companies.push(c);
      }
    }

    // ICP scoring — fetch admin weights + freshsales tag config (cached 1h)
    let icpWeights: Partial<IcpWeights> = {};
    let fsSettings: Partial<FreshsalesSettings> | null = null;
    try {
      const cachedWeights = await getCached<IcpWeights>("admin:icp-weights");
      const cachedFs = await getCached<FreshsalesSettings>("admin:freshsales-settings");
      if (cachedWeights) {
        icpWeights = cachedWeights;
        fsSettings = cachedFs;
      } else {
        const supabase = createServerClient();
        const { data: configRow } = await supabase
          .from("admin_config")
          .select("icp_weights, freshsales_settings")
          .eq("id", "global")
          .single();
        if (configRow?.icp_weights) {
          icpWeights = configRow.icp_weights as IcpWeights;
          await setCached("admin:icp-weights", icpWeights, CACHE_TTLS.adminConfig);
        }
        if (configRow?.freshsales_settings) {
          fsSettings = configRow.freshsales_settings as FreshsalesSettings;
          await setCached("admin:freshsales-settings", fsSettings, CACHE_TTLS.adminConfig);
        }
      }
    } catch { /* use defaults */ }

    const scoringContext = {
      verticals: filters?.verticals ?? [],
      regions: filters?.regions ?? [],
      sizes: filters?.sizes ?? [],
      signals: filters?.signals?.map(String) ?? [],
      tagScoringRules: fsSettings?.tagScoringRules,
      stalledDealThresholdDays: fsSettings?.stalledDealThresholdDays,
    };

    for (const c of companies) {
      const { score, breakdown } = calculateIcpScore(c, icpWeights, scoringContext);
      c.icpScore = score;
      c.icpBreakdown = breakdown;
    }

    // NL ICP scoring — only for discovery queries, not company name lookups
    // Skip if less than 1.5s remaining on the search deadline
    let nlIcpCriteria: NLICPCriteria | null = null;
    if (!isNameQuery && freeText && remainingMs() >= 1500) {
      const nlStart = Date.now();
      try {
        nlIcpCriteria = await extractICPCriteria(freeText);
        const nlScores = await scoreCompaniesAgainstICP(nlIcpCriteria, companies);
        const scoreMap = new Map(nlScores.map((s) => [s.domain, s]));
        for (const c of companies) {
          const nlScore = scoreMap.get(c.domain);
          if (nlScore) {
            c.nlIcpScore = nlScore.score;
            c.nlIcpReasoning = nlScore.reasoning;
            // Blend: NL ICP score takes priority for sorting
            c.icpScore = nlScore.score;
          }
        }
      } catch (err) {
        nlIcpError = err instanceof Error ? err.message : "NL ICP scoring failed";
        errors.push(classifyError(err, "nl-icp"));
        console.warn("[Search] NL ICP scoring failed, using rule-based:", err);
      }
      nlIcpScoringMs = Date.now() - nlStart;
    }

    // Sort by ICP score descending — best results first
    companies.sort((a, b) => b.icpScore - a.icpScore);

    // Exact match detection: strip legal suffixes from both query and candidates
    const queryLower = (freeText || "").toLowerCase().trim();
    const strippedQueryLower = stripLegalSuffix(queryLower);
    if (strippedQueryLower) {
      const matches: typeof companies = [];
      for (const c of companies) {
        // Already marked as exact match by Serper knowledge graph
        if (c.exactMatch) { matches.push(c); continue; }
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
          matches.push(c);
        }
      }
      if (matches.length > 0) {
        // Pick the match with the highest employee count
        const best = matches.reduce((a, b) => (b.employeeCount > a.employeeCount ? b : a), matches[0]);
        best.exactMatch = true;
        // Move exact match to index 0
        const idx = companies.indexOf(best);
        if (idx > 0) {
          companies.splice(idx, 1);
          companies.unshift(best);
        }
      }
    }

    // Compute high-fit count + total duration
    highFitCount = companies.filter((c) => c.icpScore >= 70).length;
    const totalDurationMs = Date.now() - searchStart;

    // Track usage event (fire-and-forget)
    if (body.userName) {
      trackUsageEventServer("search", body.userName, {
        query: freeText || null,
        isNameQuery,
        searchEngine,
        resultCount: companies.length,
        highFitCount,
        totalDurationMs,
      });
    }

    // Log search to history (fire-and-forget) with perf fields
    if (body.userName) {
      const supabase = createServerClient();
      supabase
        .from("search_history")
        .insert({
          user_name: body.userName,
          filters: filters || { freeText },
          result_count: companies.length,
          total_duration_ms: totalDurationMs,
          reformulation_ms: reformulationMs,
          exa_duration_ms: exaDurationMs,
          apollo_duration_ms: apolloDurationMs,
          nl_icp_scoring_ms: nlIcpScoringMs || null,
          exa_cache_hit: exaCacheHit,
          exa_result_count: exaResultCount,
          apollo_enriched_count: apolloEnrichedCount,
          high_fit_count: highFitCount,
          exa_error: exaError,
          apollo_error: apolloError,
          nl_icp_error: nlIcpError,
          query_text: freeText || null,
          search_engine: searchEngine,
          engine_errors: errors.length > 0 ? errors : [],
          warnings: warnings.length > 0 ? warnings : [],
          query_simplified: querySimplified,
          unenriched_count: companies.length - apolloEnrichedCount,
        })
        .then(({ error: histErr }) => {
          if (histErr) console.warn("[Search] Failed to log history:", histErr);
        });
    }

    const usageSummary = getUsageSummary();

    return NextResponse.json({
      companies,
      signals: searchSignals,
      reformulatedQueries,
      extractedEntities,
      nlIcpCriteria,
      excludedCount,
      searchEngine,
      usageSummary,
      errors,
      warnings,
      didYouMean,
      searchMeta: {
        totalDurationMs,
        engineUsed: searchEngine,
        enrichedCount: apolloEnrichedCount,
        unenrichedCount: companies.length - apolloEnrichedCount,
      },
    });
  } catch (err) {
    console.error("[Search] search failed:", err);
    const fatalError = classifyError(err, searchEngine);
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries,
      error: "Search failed. Please try again.",
      errors: [fatalError],
      warnings: [],
      searchMeta: {
        totalDurationMs: Date.now() - searchStart,
        engineUsed: searchEngine,
        enrichedCount: 0,
        unenrichedCount: 0,
      },
    }, { status: 500 });
  }
}
