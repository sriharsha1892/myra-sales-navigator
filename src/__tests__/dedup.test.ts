import { describe, it, expect } from "vitest";
import { deduplicateCompanies, getSourceLabel } from "@/lib/dedup";
import type { CompanyEnriched, ResultSource } from "@/lib/types";

function makeCompany(overrides: Partial<CompanyEnriched> = {}): CompanyEnriched {
  return {
    domain: "example.com",
    name: "Example",
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
    sources: ["exa"],
    signals: [],
    contactCount: 3,
    lastRefreshed: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("deduplicateCompanies", () => {
  it("passes through a single company unchanged", () => {
    const companies = [makeCompany()];
    const result = deduplicateCompanies(companies);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("example.com");
  });

  it("merges two companies with same domain", () => {
    const c1 = makeCompany({ sources: ["exa"], icpScore: 60, lastRefreshed: "2025-01-01T00:00:00Z" });
    const c2 = makeCompany({ sources: ["apollo"], icpScore: 80, lastRefreshed: "2025-01-02T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result).toHaveLength(1);
  });

  it("deduplicates www. vs non-www. domains", () => {
    const c1 = makeCompany({ domain: "www.example.com", sources: ["exa"] });
    const c2 = makeCompany({ domain: "example.com", sources: ["apollo"] });
    const result = deduplicateCompanies([c1, c2]);
    expect(result).toHaveLength(1);
  });

  it("keeps distinct domains separate", () => {
    const c1 = makeCompany({ domain: "foo.com" });
    const c2 = makeCompany({ domain: "bar.com" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateCompanies([])).toHaveLength(0);
  });
});

describe("mergeCompanies (via deduplicateCompanies)", () => {
  it("newest company wins as primary", () => {
    const c1 = makeCompany({ name: "Old", lastRefreshed: "2025-01-01T00:00:00Z" });
    const c2 = makeCompany({ name: "New", lastRefreshed: "2025-06-01T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].name).toBe("New");
  });

  it("unions sources from all companies", () => {
    const c1 = makeCompany({ sources: ["exa"], lastRefreshed: "2025-01-01T00:00:00Z" });
    const c2 = makeCompany({ sources: ["apollo"], lastRefreshed: "2025-01-02T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].sources).toContain("exa");
    expect(result[0].sources).toContain("apollo");
  });

  it("deduplicates signals by id", () => {
    const signal = { id: "s1", companyDomain: "example.com", type: "hiring" as const, title: "Hiring", description: "desc", date: "2025-01-01", sourceUrl: null, source: "exa" as const };
    const c1 = makeCompany({ signals: [signal], lastRefreshed: "2025-01-01T00:00:00Z" });
    const c2 = makeCompany({ signals: [signal], lastRefreshed: "2025-01-02T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].signals).toHaveLength(1);
  });

  it("takes max contactCount", () => {
    const c1 = makeCompany({ contactCount: 5, lastRefreshed: "2025-01-01T00:00:00Z" });
    const c2 = makeCompany({ contactCount: 10, lastRefreshed: "2025-01-02T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].contactCount).toBe(10);
  });

  it("takes max icpScore", () => {
    const c1 = makeCompany({ icpScore: 40, lastRefreshed: "2025-01-01T00:00:00Z" });
    const c2 = makeCompany({ icpScore: 90, lastRefreshed: "2025-01-02T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].icpScore).toBe(90);
  });

  it("backfills optional fields from secondary companies", () => {
    const c1 = makeCompany({ revenue: undefined, founded: undefined, lastRefreshed: "2025-06-01T00:00:00Z" });
    const c2 = makeCompany({ revenue: "$1B", founded: "1990", lastRefreshed: "2025-01-01T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].revenue).toBe("$1B");
    expect(result[0].founded).toBe("1990");
  });

  it("backfills phone from secondary", () => {
    const c1 = makeCompany({ phone: undefined, lastRefreshed: "2025-06-01T00:00:00Z" });
    const c2 = makeCompany({ phone: "+1-555-0100", lastRefreshed: "2025-01-01T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].phone).toBe("+1-555-0100");
  });

  it("backfills logoUrl from secondary", () => {
    const c1 = makeCompany({ logoUrl: undefined, lastRefreshed: "2025-06-01T00:00:00Z" });
    const c2 = makeCompany({ logoUrl: "https://logo.com/img.png", lastRefreshed: "2025-01-01T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].logoUrl).toBe("https://logo.com/img.png");
  });

  it("backfills description from secondary", () => {
    const c1 = makeCompany({ description: "", lastRefreshed: "2025-06-01T00:00:00Z" });
    const c2 = makeCompany({ description: "A great company", lastRefreshed: "2025-01-01T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].description).toBe("A great company");
  });

  it("handles all companies missing optional fields", () => {
    const c1 = makeCompany({ revenue: undefined, founded: undefined, phone: undefined, logoUrl: undefined, lastRefreshed: "2025-06-01T00:00:00Z" });
    const c2 = makeCompany({ revenue: undefined, founded: undefined, phone: undefined, logoUrl: undefined, lastRefreshed: "2025-01-01T00:00:00Z" });
    const result = deduplicateCompanies([c1, c2]);
    expect(result[0].revenue).toBeUndefined();
    expect(result[0].founded).toBeUndefined();
  });
});

describe("getSourceLabel", () => {
  it("returns empty string for empty sources", () => {
    expect(getSourceLabel([])).toBe("");
  });

  it("returns empty string for single source", () => {
    expect(getSourceLabel(["exa"])).toBe("");
  });

  it("returns label for two sources", () => {
    expect(getSourceLabel(["exa", "apollo"])).toBe("Found by Exa + Apollo");
  });

  it("returns label for all three sources", () => {
    expect(getSourceLabel(["exa", "apollo", "hubspot"])).toBe("Found by Exa + Apollo + HubSpot");
  });
});
