import { NextResponse } from "next/server";
import { reformulateQuery, looksLikeCompanyName } from "@/lib/exa/queryBuilder";
import { searchExa, isExaAvailable } from "@/lib/providers/exa";
import {
  isApolloAvailable,
  enrichCompany,
  findContacts,
} from "@/lib/providers/apollo";
import { createServerClient } from "@/lib/supabase/server";
import type { Company, FilterState } from "@/lib/types";

// ---------------------------------------------------------------------------
// Apollo structured search — enrich Exa domains + find contacts in parallel
// Returns enriched companies (Apollo firmographics merged onto Exa shells)
// ---------------------------------------------------------------------------

async function apolloStructuredSearch(
  exaCompanies: Company[]
): Promise<Company[]> {
  if (!isApolloAvailable() || exaCompanies.length === 0) return [];

  // Pick up to 25 unique domains from Exa results for Apollo enrichment
  const domains = [...new Set(exaCompanies.map((c) => c.domain))].slice(0, 25);

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

  // LLM query reformulation (Groq) — expands raw text into semantic queries
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
  const reformulatedQueries = await reformulateQuery(
    freeText || "",
    filters || defaultFilters
  );

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
    const isNameQuery = looksLikeCompanyName(freeText || "");
    const numResults = isNameQuery ? 8 : 25;
    console.log("[Search] primaryQuery:", primaryQuery, "isNameQuery:", isNameQuery);

    // Parallel: Exa semantic search + exclusion list fetch
    const [exaResult, excluded] = await Promise.all([
      searchExa({ query: primaryQuery, numResults }),
      filters?.hideExcluded !== false ? getExcludedValues() : Promise.resolve(new Set<string>()),
    ]);

    // Apply exclusion filter to Exa results
    const filteredExa = applyExclusionFilter(exaResult.companies, excluded);
    const exaCompanies = filteredExa.slice(0, 25);

    // Apollo structured enrichment — runs in parallel on Exa domains
    // Merges firmographic data (industry, size, location) onto Exa shells
    const apolloEnriched = await apolloStructuredSearch(exaCompanies);

    // Build final company list: Apollo-enriched where available, raw Exa otherwise
    const enrichedDomains = new Set(apolloEnriched.map((c) => c.domain));
    const companies = exaCompanies.map(
      (c) =>
        enrichedDomains.has(c.domain)
          ? apolloEnriched.find((e) => e.domain === c.domain)!
          : c
    );

    // Exact match detection: flag company whose domain or name closely matches the query
    const queryLower = (freeText || "").toLowerCase().trim();
    if (queryLower) {
      for (const c of companies) {
        const domainBase = c.domain.replace(/\.(com|io|org|net|co|ai|de|it|eu)$/i, "").toLowerCase();
        const nameLower = c.name.toLowerCase();
        if (
          domainBase === queryLower ||
          nameLower === queryLower ||
          domainBase.includes(queryLower.replace(/\s+/g, "")) ||
          nameLower.includes(queryLower)
        ) {
          c.exactMatch = true;
          break; // Only one exact match
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
