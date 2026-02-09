import { NextResponse } from "next/server";
import { reformulateQueryWithEntities, looksLikeCompanyName } from "@/lib/navigator/exa/queryBuilder";
import { searchExa, isExaAvailable } from "@/lib/navigator/providers/exa";
import {
  isApolloAvailable,
  enrichCompany,
  findContacts,
} from "@/lib/navigator/providers/apollo";
import { createServerClient } from "@/lib/supabase/server";
import { calculateIcpScore } from "@/lib/navigator/scoring";
import { getCached, setCached, getRootDomain } from "@/lib/cache";
import { extractICPCriteria, scoreCompaniesAgainstICP } from "@/lib/navigator/llm/icpPrompts";
import type { Company, FilterState, IcpWeights, NLICPCriteria } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Apollo structured search — enrich Exa domains + find contacts in parallel
// Returns enriched companies (Apollo firmographics merged onto Exa shells)
// ---------------------------------------------------------------------------

async function getEnrichmentLimits(): Promise<{ maxSearchEnrich: number; maxContactAutoEnrich: number; maxClearoutFinds: number }> {
  const defaults = { maxSearchEnrich: 10, maxContactAutoEnrich: 5, maxClearoutFinds: 10 };
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
      await setCached("admin:enrichment-limits", limits, 60);
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
    const supabase = createServerClient();
    const { data } = await supabase.from("exclusions").select("type, value");
    if (!data) return new Set();

    const values = new Set<string>();
    for (const row of data) {
      // Normalize: lowercase for case-insensitive matching
      values.add(String(row.value).toLowerCase());
    }
    return values;
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
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: { filters?: FilterState; freeText?: string; userName?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const filters = body.filters;
  const freeText = body.freeText;

  if (!filters && !freeText) {
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries: [],
      message: "No search criteria provided.",
    });
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

  if (!isExaAvailable()) {
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries,
      message: "EXA_API_KEY not configured. Search unavailable.",
    }, { status: 503 });
  }

  try {
    const primaryQuery = reformulatedQueries[0] || freeText || "";
    const numResults = isNameQuery ? 15 : 25;
    console.log("[Search] primaryQuery:", primaryQuery, "isNameQuery:", isNameQuery);

    // Parallel: Exa semantic search + exclusion list fetch
    const [exaResult, excluded] = await Promise.all([
      searchExa({ query: primaryQuery, numResults }),
      filters?.hideExcluded !== false ? getExcludedValues() : Promise.resolve(new Set<string>()),
    ]);

    // Apply exclusion filter to Exa results
    const filteredExa = applyExclusionFilter(exaResult.companies, excluded);
    const excludedCount = exaResult.companies.length - filteredExa.length;
    const exaCompanies = filteredExa.slice(0, 25);

    // Apollo structured enrichment — runs in parallel on Exa domains
    // Smart Enrich: only top N by Exa relevance (admin-configurable, default 10)
    const enrichLimits = await getEnrichmentLimits();
    const apolloEnriched = await apolloStructuredSearch(exaCompanies, enrichLimits.maxSearchEnrich);

    // Build final company list: Apollo-enriched where available, raw Exa otherwise
    const enrichedDomains = new Set(apolloEnriched.map((c) => c.domain));
    const merged = exaCompanies.map(
      (c) =>
        enrichedDomains.has(c.domain)
          ? apolloEnriched.find((e) => e.domain === c.domain)!
          : c
    );

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

    // ICP scoring — fetch admin weights (cached 1h), score each company
    let icpWeights: Partial<IcpWeights> = {};
    try {
      const cachedWeights = await getCached<IcpWeights>("admin:icp-weights");
      if (cachedWeights) {
        icpWeights = cachedWeights;
      } else {
        const supabase = createServerClient();
        const { data: configRow } = await supabase
          .from("admin_config")
          .select("icp_weights")
          .eq("id", "global")
          .single();
        if (configRow?.icp_weights) {
          icpWeights = configRow.icp_weights as IcpWeights;
          await setCached("admin:icp-weights", icpWeights, 60); // 1h cache
        }
      }
    } catch { /* use defaults */ }

    const scoringContext = {
      verticals: filters?.verticals ?? [],
      regions: filters?.regions ?? [],
      sizes: filters?.sizes ?? [],
      signals: filters?.signals?.map(String) ?? [],
    };

    for (const c of companies) {
      const { score, breakdown } = calculateIcpScore(c, icpWeights, scoringContext);
      c.icpScore = score;
      c.icpBreakdown = breakdown;
    }

    // NL ICP scoring — only for discovery queries, not company name lookups
    let nlIcpCriteria: NLICPCriteria | null = null;
    if (!isNameQuery && freeText) {
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
        console.warn("[Search] NL ICP scoring failed, using rule-based:", err);
      }
    }

    // Sort by ICP score descending — best results first
    companies.sort((a, b) => b.icpScore - a.icpScore);

    // Exact match detection: find ALL matching companies, pick the largest
    const queryLower = (freeText || "").toLowerCase().trim();
    if (queryLower) {
      const matches: typeof companies = [];
      for (const c of companies) {
        const domainBase = c.domain.replace(/\.(com|io|org|net|co|ai|de|it|eu)$/i, "").toLowerCase();
        const nameLower = c.name.toLowerCase();
        if (
          domainBase === queryLower ||
          nameLower === queryLower ||
          domainBase.includes(queryLower.replace(/\s+/g, "")) ||
          nameLower.includes(queryLower)
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

    // Log search to history (fire-and-forget)
    if (body.userName) {
      const supabase = createServerClient();
      supabase
        .from("search_history")
        .insert({
          user_name: body.userName,
          filters: filters || { freeText },
          result_count: companies.length,
        })
        .then(({ error: histErr }) => {
          if (histErr) console.warn("[Search] Failed to log history:", histErr);
        });
    }

    return NextResponse.json({
      companies,
      signals: exaResult.signals,
      reformulatedQueries,
      extractedEntities,
      nlIcpCriteria,
      excludedCount,
    });
  } catch (err) {
    console.error("[Search] search failed:", err);
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries,
      error: "Search failed. Please try again.",
    }, { status: 500 });
  }
}
