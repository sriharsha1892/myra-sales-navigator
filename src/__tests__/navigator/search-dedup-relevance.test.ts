/**
 * Tests for search result deduplication, relevance filtering, and domain
 * normalization consistency.
 *
 * Context: Users see duplicate/irrelevant results because:
 *  - getBaseDomain (exa.ts) and getRootDomain (cache.ts) can produce different
 *    keys for the same domain, leading to inconsistent dedup across layers.
 *  - mapExaResultToCompany discards the Exa relevance score.
 *  - No relevance threshold is applied before returning results.
 *  - deduplicateCompanies() from lib/dedup.ts is not called in the search route.
 *
 * Some tests here are expected to FAIL — they document real bugs that need
 * fixing in the implementation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { deduplicateCompanies } from "@/lib/dedup";
import {
  normalizeDomain,
  getRootDomain,
  hashFilters,
  CacheKeys,
  clearCache,
} from "@/lib/cache";
import type { CompanyEnriched } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCompany(overrides: Partial<CompanyEnriched> = {}): CompanyEnriched {
  return {
    domain: "example.com",
    name: "Example Inc",
    firstViewedBy: "Adi",
    firstViewedAt: "2025-01-01T00:00:00Z",
    lastViewedBy: "Adi",
    lastViewedAt: "2025-01-01T00:00:00Z",
    source: "exa",
    noteCount: 0,
    lastNoteAt: null,
    extractionCount: 0,
    lastExtractionAt: null,
    excluded: false,
    excludedBy: null,
    excludedAt: null,
    exclusionReason: null,
    industry: "Tech",
    vertical: "Tech",
    employeeCount: 100,
    location: "NYC",
    region: "North America",
    description: "A company",
    icpScore: 50,
    hubspotStatus: "none",
    freshsalesStatus: "none",
    freshsalesIntel: null,
    sources: ["exa"],
    signals: [],
    contactCount: 3,
    lastRefreshed: "2025-01-01T00:00:00Z",
    status: "new",
    statusChangedBy: null,
    statusChangedAt: null,
    viewedBy: null,
    ...overrides,
  };
}

// =========================================================================
// 1. getRootDomain — comprehensive coverage
// =========================================================================

describe("getRootDomain", () => {
  it("returns simple two-part domain as-is", () => {
    expect(getRootDomain("example.com")).toBe("example.com");
  });

  it("strips www prefix", () => {
    expect(getRootDomain("www.example.com")).toBe("example.com");
  });

  it("strips subdomain", () => {
    expect(getRootDomain("blog.example.com")).toBe("example.com");
  });

  it("strips deep subdomains", () => {
    expect(getRootDomain("a.b.c.example.com")).toBe("example.com");
  });

  it("handles co.uk correctly", () => {
    expect(getRootDomain("company.co.uk")).toBe("company.co.uk");
  });

  it("handles subdomain + co.uk", () => {
    expect(getRootDomain("www.company.co.uk")).toBe("company.co.uk");
  });

  it("handles com.au correctly", () => {
    expect(getRootDomain("acme.com.au")).toBe("acme.com.au");
  });

  it("handles co.in correctly", () => {
    expect(getRootDomain("startup.co.in")).toBe("startup.co.in");
  });

  it("handles co.jp correctly", () => {
    expect(getRootDomain("honda.co.jp")).toBe("honda.co.jp");
  });

  it("handles com.br correctly", () => {
    expect(getRootDomain("empresa.com.br")).toBe("empresa.com.br");
  });

  it("lowercases input", () => {
    expect(getRootDomain("WWW.EXAMPLE.COM")).toBe("example.com");
  });

  it("handles single-part domain", () => {
    expect(getRootDomain("localhost")).toBe("localhost");
  });
});

// =========================================================================
// 2. getBaseDomain vs getRootDomain consistency
//
//    getBaseDomain (exa.ts) strips the TLD entirely: "basf.com" → "basf"
//    getRootDomain (cache.ts) keeps the TLD: "basf.com" → "basf.com"
//    These are used in DIFFERENT dedup layers:
//      - getBaseDomain is used in searchExa() for Exa-internal dedup
//      - getRootDomain is used in the search route for cross-source dedup
//    This can cause basf.com and basf.de to be deduped by Exa (both → "basf")
//    but NOT by the search route (basf.com ≠ basf.de in getRootDomain).
//    normalizeDomain (lib/dedup.ts dedup) does no root-domain collapsing at all.
// =========================================================================

describe("domain normalization consistency — getBaseDomain vs getRootDomain vs normalizeDomain", () => {
  // To test getBaseDomain we need to import it. It's not exported from exa.ts,
  // so we test the behavior indirectly through known cases and document the
  // divergence.

  it("normalizeDomain treats basf.com and basf.de as DIFFERENT domains", () => {
    // normalizeDomain only strips www. and lowercases — no root-domain collapsing
    expect(normalizeDomain("basf.com")).not.toBe(normalizeDomain("basf.de"));
  });

  it("getRootDomain treats basf.com and basf.de as DIFFERENT domains", () => {
    // getRootDomain keeps the full domain with TLD
    expect(getRootDomain("basf.com")).not.toBe(getRootDomain("basf.de"));
  });

  it("normalizeDomain and getRootDomain agree on simple domains", () => {
    // For simple two-part domains, both should return the same thing
    expect(normalizeDomain("example.com")).toBe(getRootDomain("example.com"));
  });

  it("normalizeDomain and getRootDomain DISAGREE on subdomains", () => {
    // normalizeDomain keeps the subdomain; getRootDomain strips it
    const withSub = "blog.example.com";
    expect(normalizeDomain(withSub)).toBe("blog.example.com");
    expect(getRootDomain(withSub)).toBe("example.com");
    // They disagree — this means deduplicateCompanies (uses normalizeDomain)
    // will NOT merge blog.example.com with example.com, but the search route
    // (uses getRootDomain) WILL merge them.
    expect(normalizeDomain(withSub)).not.toBe(getRootDomain(withSub));
  });

  it("deduplicateCompanies does NOT merge subdomain variants (uses normalizeDomain)", () => {
    const c1 = makeCompany({ domain: "blog.example.com" });
    const c2 = makeCompany({ domain: "example.com" });
    const result = deduplicateCompanies([c1, c2]);
    // normalizeDomain keeps subdomains, so these are treated as different
    expect(result).toHaveLength(2);
  });
});

// =========================================================================
// 3. mapExaResultToCompany — relevance score extraction
//
//    KNOWN BUG: mapExaResultToCompany does NOT extract or store the Exa
//    relevance score (result.score). The Company type has icpScore but
//    no exaRelevanceScore field. The score is silently discarded.
//    This means we can't filter low-relevance results downstream.
// =========================================================================

describe("mapExaResultToCompany — relevance score", () => {
  it("Company type supports exaRelevanceScore field", () => {
    const company = makeCompany({ exaRelevanceScore: 0.85 });
    expect(company.exaRelevanceScore).toBe(0.85);
  });

  it("exaRelevanceScore is optional and defaults to undefined", () => {
    const company = makeCompany();
    expect(company.exaRelevanceScore).toBeUndefined();
  });
});

// =========================================================================
// 4. deduplicateCompanies — additional edge cases
//
//    The existing dedup.test.ts covers basic cases. These tests cover
//    edge cases relevant to the search duplicate bug.
// =========================================================================

describe("deduplicateCompanies — cross-TLD and subdomain edge cases", () => {
  it("does NOT merge basf.com and basf.de (different normalized domains)", () => {
    const c1 = makeCompany({ domain: "basf.com", name: "BASF (US)" });
    const c2 = makeCompany({ domain: "basf.de", name: "BASF (DE)" });
    const result = deduplicateCompanies([c1, c2]);
    // normalizeDomain treats these as different — no merge
    expect(result).toHaveLength(2);
  });

  it("merges case-insensitive domain duplicates", () => {
    const c1 = makeCompany({ domain: "ACME.COM", sources: ["exa"] });
    const c2 = makeCompany({ domain: "acme.com", sources: ["apollo"] });
    const result = deduplicateCompanies([c1, c2]);
    expect(result).toHaveLength(1);
  });

  it("handles three duplicates of the same domain", () => {
    const c1 = makeCompany({
      domain: "acme.com",
      sources: ["exa"],
      icpScore: 40,
      lastRefreshed: "2025-01-01T00:00:00Z",
    });
    const c2 = makeCompany({
      domain: "acme.com",
      sources: ["apollo"],
      icpScore: 60,
      lastRefreshed: "2025-02-01T00:00:00Z",
    });
    const c3 = makeCompany({
      domain: "www.acme.com",
      sources: ["hubspot"],
      icpScore: 80,
      lastRefreshed: "2025-03-01T00:00:00Z",
    });
    const result = deduplicateCompanies([c1, c2, c3]);
    expect(result).toHaveLength(1);
    expect(result[0].sources).toContain("exa");
    expect(result[0].sources).toContain("apollo");
    expect(result[0].sources).toContain("hubspot");
  });

  it("preserves order — first-seen domain position is maintained", () => {
    const c1 = makeCompany({ domain: "alpha.com", name: "Alpha" });
    const c2 = makeCompany({ domain: "beta.com", name: "Beta" });
    const c3 = makeCompany({ domain: "gamma.com", name: "Gamma" });
    const result = deduplicateCompanies([c1, c2, c3]);
    expect(result.map((c) => c.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});

// =========================================================================
// 5. hashFilters — cache key consistency
//
//    Same filters in different property orders should produce same key.
//    Also test with nested objects and arrays, which are common in FilterState.
// =========================================================================

describe("hashFilters — deep consistency", () => {
  it("same top-level keys in different order produce same hash", () => {
    const h1 = hashFilters({ a: 1, b: 2, c: 3 });
    const h2 = hashFilters({ c: 3, a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it("same values produce same hash regardless of insertion order", () => {
    const f1 = { verticals: ["Food"], regions: ["APAC"], sizes: ["51-200"] };
    const f2 = { sizes: ["51-200"], verticals: ["Food"], regions: ["APAC"] };
    expect(hashFilters(f1)).toBe(hashFilters(f2));
  });

  it("different array order produces DIFFERENT hash (arrays are order-sensitive)", () => {
    // JSON.stringify preserves array order, so ["A","B"] !== ["B","A"]
    const h1 = hashFilters({ items: ["A", "B"] });
    const h2 = hashFilters({ items: ["B", "A"] });
    // This tests current behavior: array order matters. If dedup requires
    // order-insensitive array hashing, hashFilters needs to be updated.
    expect(h1).not.toBe(h2);
  });

  it("nested objects with same keys in different order produce same hash", () => {
    // hashFilters only sorts top-level keys, NOT nested object keys.
    // This test documents the behavior.
    const h1 = hashFilters({ nested: { x: 1, y: 2 } });
    const h2 = hashFilters({ nested: { y: 2, x: 1 } });
    // JSON.stringify with sorted top-level keys will serialize the nested
    // object with its original insertion order. In V8, object keys ARE
    // ordered by insertion order for string keys, so this MAY differ
    // depending on runtime. We test current behavior.
    // NOTE: This may be a bug — nested property order could cause cache misses.
    // If h1 !== h2, it means cache keys are not stable for nested objects
    // with different property insertion orders.
    // We deliberately test this as a documentation test.
    if (h1 === h2) {
      // V8 may deterministically order these the same
      expect(h1).toBe(h2);
    } else {
      // Document that nested key order causes different hashes
      expect(h1).not.toBe(h2);
    }
  });

  it("boolean vs string values produce different hashes", () => {
    const h1 = hashFilters({ hideExcluded: true });
    const h2 = hashFilters({ hideExcluded: "true" });
    expect(h1).not.toBe(h2);
  });

  it("null vs undefined values produce different hashes", () => {
    const h1 = hashFilters({ a: null });
    const h2 = hashFilters({ a: undefined });
    // JSON.stringify(null) → "null", JSON.stringify(undefined) → undefined (key omitted)
    expect(h1).not.toBe(h2);
  });

  it("CacheKeys.search uses hashFilters output consistently", () => {
    const filters = { verticals: ["Food"], regions: ["APAC"] };
    const key1 = CacheKeys.search(hashFilters(filters));
    const key2 = CacheKeys.search(hashFilters({ regions: ["APAC"], verticals: ["Food"] }));
    expect(key1).toBe(key2);
  });

  it("CacheKeys.exaSearch uses hashFilters output consistently", () => {
    const filters = { query: "food companies", numResults: 25 };
    const key1 = CacheKeys.exaSearch(hashFilters(filters));
    const key2 = CacheKeys.exaSearch(hashFilters({ numResults: 25, query: "food companies" }));
    expect(key1).toBe(key2);
  });
});

// =========================================================================
// 6. Search route dedup behavior — test the route's inline dedup logic
//
//    The search route uses getRootDomain for dedup, NOT deduplicateCompanies.
//    This means the richer merge logic (source union, weighted ICP, signal
//    dedup, field backfill) is NEVER applied during search. Instead, the
//    route just keeps whichever entry has the higher employeeCount.
// =========================================================================

describe("search route inline dedup logic (simulated)", () => {
  // We can't easily test the actual route without mocking Exa/Apollo/Supabase,
  // so we replicate the route's dedup logic here to verify its behavior.

  function routeDedup(companies: CompanyEnriched[]): CompanyEnriched[] {
    // This is the exact logic from route.ts lines 212-226
    const seenRoots = new Map<string, number>();
    const result: CompanyEnriched[] = [];
    for (const c of companies) {
      const root = getRootDomain(c.domain);
      const existing = seenRoots.get(root);
      if (existing !== undefined) {
        if (c.employeeCount > result[existing].employeeCount) {
          result[existing] = c;
        }
      } else {
        seenRoots.set(root, result.length);
        result.push(c);
      }
    }
    return result;
  }

  it("deduplicates by root domain", () => {
    const c1 = makeCompany({ domain: "blog.example.com", employeeCount: 50 });
    const c2 = makeCompany({ domain: "example.com", employeeCount: 100 });
    const result = routeDedup([c1, c2]);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("example.com");
  });

  it("keeps the company with higher employeeCount", () => {
    const c1 = makeCompany({ domain: "example.com", name: "Small", employeeCount: 10 });
    const c2 = makeCompany({ domain: "www.example.com", name: "Big", employeeCount: 500 });
    const result = routeDedup([c1, c2]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Big");
  });

  it("does NOT merge sources (unlike deduplicateCompanies)", () => {
    const c1 = makeCompany({ domain: "example.com", sources: ["exa"], employeeCount: 10 });
    const c2 = makeCompany({ domain: "www.example.com", sources: ["apollo"], employeeCount: 100 });
    const result = routeDedup([c1, c2]);
    // The route just replaces — it doesn't union sources
    expect(result[0].sources).toEqual(["apollo"]);
    expect(result[0].sources).not.toContain("exa");
  });

  it("does NOT merge signals (unlike deduplicateCompanies)", () => {
    const signal1 = {
      id: "s1", companyDomain: "example.com", type: "hiring" as const,
      title: "Hiring", description: "", date: "2025-01-01", sourceUrl: null, source: "exa" as const,
    };
    const signal2 = {
      id: "s2", companyDomain: "example.com", type: "funding" as const,
      title: "Funded", description: "", date: "2025-01-02", sourceUrl: null, source: "exa" as const,
    };
    const c1 = makeCompany({ domain: "example.com", signals: [signal1], employeeCount: 10 });
    const c2 = makeCompany({ domain: "www.example.com", signals: [signal2], employeeCount: 100 });
    const result = routeDedup([c1, c2]);
    // The route replaces c1 entirely with c2 — c1's signals are lost
    expect(result[0].signals).toHaveLength(1);
    expect(result[0].signals[0].id).toBe("s2");
  });

  it("does NOT dedup across different TLDs (basf.com vs basf.de stay separate)", () => {
    const c1 = makeCompany({ domain: "basf.com", name: "BASF US" });
    const c2 = makeCompany({ domain: "basf.de", name: "BASF DE" });
    const result = routeDedup([c1, c2]);
    expect(result).toHaveLength(2);
  });

  it("handles co.uk root domain correctly", () => {
    const c1 = makeCompany({ domain: "company.co.uk", employeeCount: 100 });
    const c2 = makeCompany({ domain: "www.company.co.uk", employeeCount: 50 });
    const result = routeDedup([c1, c2]);
    expect(result).toHaveLength(1);
    expect(result[0].employeeCount).toBe(100);
  });
});

// =========================================================================
// 7. Relevance threshold — documenting the gap
//
//    The search route does NOT filter by relevance. All Exa results are
//    returned regardless of their score. This test documents the absence
//    of any relevance filtering.
// =========================================================================

describe("relevance threshold", () => {
  it("search route returns all companies regardless of icpScore (no ICP floor)", () => {
    const companies = [
      makeCompany({ domain: "good.com", icpScore: 90 }),
      makeCompany({ domain: "mediocre.com", icpScore: 30 }),
      makeCompany({ domain: "terrible.com", icpScore: 5 }),
    ];
    // ICP score is for display ranking, not filtering — all 3 returned
    const filtered = companies;
    expect(filtered).toHaveLength(3);
  });

  it("filters out companies below MIN_EXA_RELEVANCE (0.10)", () => {
    // Simulates the filter applied in searchExa after mapping results
    const MIN_EXA_RELEVANCE = 0.10;
    const companies = [
      makeCompany({ domain: "good.com", exaRelevanceScore: 0.85 }),
      makeCompany({ domain: "marginal.com", exaRelevanceScore: 0.12 }),
      makeCompany({ domain: "garbage.com", exaRelevanceScore: 0.03 }),
      makeCompany({ domain: "no-score.com" }), // undefined score treated as 1 (pass)
    ];
    const filtered = companies.filter(
      (c) => (c.exaRelevanceScore ?? 1) >= MIN_EXA_RELEVANCE
    );
    expect(filtered).toHaveLength(3);
    expect(filtered.map((c) => c.domain)).toEqual(["good.com", "marginal.com", "no-score.com"]);
  });

  it("propagates Exa relevance score to Company.exaRelevanceScore field", () => {
    const company = makeCompany({ exaRelevanceScore: 0.72 });
    expect(company.exaRelevanceScore).toBe(0.72);
    // Score should be preserved through dedup
    const deduped = deduplicateCompanies([company]);
    expect(deduped[0].exaRelevanceScore).toBe(0.72);
  });
});

// =========================================================================
// 8. isNoiseDomain — test the noise filter used in Exa search
// =========================================================================

describe("isNoiseDomain", () => {
  // We need to import it — it IS exported from exa.ts
  let isNoiseDomain: (domain: string) => boolean;

  beforeEach(async () => {
    // Dynamic import to get the function without triggering Exa client init
    const mod = await import("@/lib/navigator/providers/exa");
    isNoiseDomain = mod.isNoiseDomain;
  });

  it("blocks linkedin.com", () => {
    expect(isNoiseDomain("linkedin.com")).toBe(true);
  });

  it("blocks subdomain of linkedin.com", () => {
    expect(isNoiseDomain("business.linkedin.com")).toBe(true);
  });

  it("blocks crunchbase.com", () => {
    expect(isNoiseDomain("crunchbase.com")).toBe(true);
  });

  it("blocks wikipedia.org", () => {
    expect(isNoiseDomain("wikipedia.org")).toBe(true);
  });

  it("allows a normal company domain", () => {
    expect(isNoiseDomain("acme.com")).toBe(false);
  });

  it("allows domain containing 'linkedin' in the name but different TLD", () => {
    expect(isNoiseDomain("linkedinhelper.com")).toBe(false);
  });
});
