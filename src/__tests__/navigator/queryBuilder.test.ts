import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildExaQuery, reformulateQuery, looksLikeCompanyName, simplifyQuery } from "@/lib/navigator/exa/queryBuilder";
import type { FilterState, SignalType } from "@/lib/navigator/types";

const emptyFilters: FilterState = {
  sources: [],
  verticals: [],
  regions: [],
  sizes: [],
  signals: [],
  statuses: [],
  hideExcluded: true,
  quickFilters: [],
};

describe("buildExaQuery", () => {
  it("returns empty string for empty filters and no freeText", () => {
    expect(buildExaQuery(emptyFilters)).toBe("");
  });

  it("returns freeText only when provided", () => {
    expect(buildExaQuery(emptyFilters, "food ingredients APAC")).toBe("food ingredients APAC");
  });

  it("builds query with verticals only", () => {
    const filters = { ...emptyFilters, verticals: ["Food Ingredients", "Chemicals"] };
    expect(buildExaQuery(filters)).toBe("industry: Food Ingredients OR Chemicals");
  });

  it("builds query with regions only", () => {
    const filters = { ...emptyFilters, regions: ["Europe", "Asia Pacific"] };
    expect(buildExaQuery(filters)).toBe("region: Europe OR Asia Pacific");
  });

  it("builds query with signals only", () => {
    const filters = { ...emptyFilters, signals: ["hiring", "funding"] as SignalType[] };
    expect(buildExaQuery(filters)).toBe("signals: hiring, funding");
  });

  it("combines all filters", () => {
    const filters: FilterState = {
      ...emptyFilters,
      verticals: ["Pharma"],
      regions: ["North America"],
      signals: ["expansion"] as SignalType[],
    };
    const result = buildExaQuery(filters);
    expect(result).toContain("industry: Pharma");
    expect(result).toContain("region: North America");
    expect(result).toContain("signals: expansion");
  });

  it("combines freeText with filters", () => {
    const filters = { ...emptyFilters, verticals: ["Tech"] };
    const result = buildExaQuery(filters, "AI startups");
    expect(result).toContain("AI startups");
    expect(result).toContain("industry: Tech");
  });

  it("trims freeText whitespace", () => {
    expect(buildExaQuery(emptyFilters, "  hello  ")).toBe("hello");
  });

  it("ignores empty freeText", () => {
    expect(buildExaQuery(emptyFilters, "   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// looksLikeCompanyName — existing company names should still be recognized
// ---------------------------------------------------------------------------

describe("looksLikeCompanyName", () => {
  // Existing company names (should return true)
  it("recognizes single-word company names", () => {
    expect(looksLikeCompanyName("BASF")).toBe(true);
    expect(looksLikeCompanyName("Brenntag")).toBe(true);
  });

  it("recognizes multi-word company names", () => {
    expect(looksLikeCompanyName("Cereal Docks")).toBe(true);
    expect(looksLikeCompanyName("Tata Steel")).toBe(true);
  });

  it("recognizes company names with legal suffixes", () => {
    expect(looksLikeCompanyName("BASF SE")).toBe(true);
    expect(looksLikeCompanyName("Brenntag AG")).toBe(true);
  });

  it("returns false for empty/blank input", () => {
    expect(looksLikeCompanyName("")).toBe(false);
    expect(looksLikeCompanyName("   ")).toBe(false);
  });

  // Discovery queries (should return false)
  it("returns false for descriptive queries", () => {
    expect(looksLikeCompanyName("food companies in Asia")).toBe(false);
    expect(looksLikeCompanyName("chemical manufacturers hiring")).toBe(false);
  });

  it("returns false for 5+ word queries", () => {
    expect(looksLikeCompanyName("mid-size food ingredients companies expanding to Asia")).toBe(false);
  });

  // Phase 4C: Qualifier detection — these should be discovery, not company names
  it("returns false when last word is an industry qualifier", () => {
    expect(looksLikeCompanyName("Nestle food")).toBe(false);
    expect(looksLikeCompanyName("German chemicals")).toBe(false);
    expect(looksLikeCompanyName("European pharma")).toBe(false);
    expect(looksLikeCompanyName("India tech")).toBe(false);
    expect(looksLikeCompanyName("US fintech")).toBe(false);
    expect(looksLikeCompanyName("APAC logistics")).toBe(false);
  });

  it("still recognizes company names where last word is NOT a qualifier", () => {
    expect(looksLikeCompanyName("Cereal Docks")).toBe(true);
    expect(looksLikeCompanyName("Acme Corp")).toBe(true);
    expect(looksLikeCompanyName("Tata Steel")).toBe(true);
  });

  it("treats 'Dow Chemical' as discovery (qualifier last word)", () => {
    // "chemical" is in qualifierWords, so "Dow Chemical" is discovery-like
    expect(looksLikeCompanyName("Dow Chemical")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// simplifyQuery
// ---------------------------------------------------------------------------

describe("simplifyQuery", () => {
  it("returns trimmed query when no simplification possible", () => {
    expect(simplifyQuery("BASF")).toBe("BASF");
  });

  it("strips size qualifiers", () => {
    const result = simplifyQuery("mid-size food companies");
    expect(result).not.toContain("mid-size");
  });

  it("returns original query if simplification would empty it", () => {
    expect(simplifyQuery("expanding")).toBe("expanding");
  });
});

// simpleHash is not exported, test via reformulateQuery behavior
describe("reformulateQuery", () => {
  beforeEach(() => {
    // Ensure GROQ_API_KEY is not set so we hit the fallback
    delete process.env.GROQ_API_KEY;
  });

  it("falls back to buildExaQuery when Groq is unavailable", async () => {
    const result = await reformulateQuery("food companies", emptyFilters);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("food companies");
  });

  it("falls back with filters when Groq is unavailable", async () => {
    const filters = { ...emptyFilters, verticals: ["Pharma"] };
    const result = await reformulateQuery("", filters);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("industry: Pharma");
  });

  it("combines rawText and filters in fallback", async () => {
    const filters = { ...emptyFilters, regions: ["Europe"] };
    const result = await reformulateQuery("specialty chemicals", filters);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("specialty chemicals");
    expect(result[0]).toContain("region: Europe");
  });
});
