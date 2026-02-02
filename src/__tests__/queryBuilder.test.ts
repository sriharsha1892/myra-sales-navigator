import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildExaQuery, reformulateQuery } from "@/lib/exa/queryBuilder";
import type { FilterState, SignalType } from "@/lib/types";

const emptyFilters: FilterState = {
  sources: [],
  verticals: [],
  regions: [],
  sizes: [],
  signals: [],
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
