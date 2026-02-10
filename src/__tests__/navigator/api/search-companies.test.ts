/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Environment stubs
// ---------------------------------------------------------------------------

vi.stubEnv("EXA_API_KEY", "test-exa");
vi.stubEnv("APOLLO_API_KEY", "test-apollo");
vi.stubEnv("SERPER_API_KEY", "test-serper");
vi.stubEnv("PARALLEL_API_KEY", "test-parallel");
vi.stubEnv("GROQ_API_KEY", "");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-key");

// ---------------------------------------------------------------------------
// Mock all providers and dependencies
// ---------------------------------------------------------------------------

const mockSearchExa = vi.fn();
const mockSearchSerper = vi.fn();
const mockSearchParallel = vi.fn();
const mockEnrichCompany = vi.fn();
const mockFindContacts = vi.fn();
const mockPickDiscoveryEngine = vi.fn();
const mockPickNameEngine = vi.fn();
const mockRecordUsage = vi.fn();
const mockIsExaFallbackAllowed = vi.fn();
const mockGetUsageSummary = vi.fn();
const mockCalculateIcpScore = vi.fn();
const mockExtractICPCriteria = vi.fn();
const mockScoreCompaniesAgainstICP = vi.fn();

vi.mock("@/lib/navigator/providers/exa", () => ({
  searchExa: (...args: unknown[]) => mockSearchExa(...args),
  isExaAvailable: vi.fn(() => true),
}));

vi.mock("@/lib/navigator/providers/serper", () => ({
  searchSerper: (...args: unknown[]) => mockSearchSerper(...args),
  isSerperAvailable: vi.fn(() => true),
}));

vi.mock("@/lib/navigator/providers/parallel", () => ({
  searchParallel: (...args: unknown[]) => mockSearchParallel(...args),
  isParallelAvailable: vi.fn(() => true),
}));

vi.mock("@/lib/navigator/providers/apollo", () => ({
  isApolloAvailable: vi.fn(() => true),
  enrichCompany: (...args: unknown[]) => mockEnrichCompany(...args),
  findContacts: (...args: unknown[]) => mockFindContacts(...args),
}));

vi.mock("@/lib/navigator/routing/smartRouter", () => ({
  pickDiscoveryEngine: (...args: unknown[]) => mockPickDiscoveryEngine(...args),
  pickNameEngine: (...args: unknown[]) => mockPickNameEngine(...args),
  recordUsage: (...args: unknown[]) => mockRecordUsage(...args),
  isExaFallbackAllowed: (...args: unknown[]) => mockIsExaFallbackAllowed(...args),
  getUsageSummary: (...args: unknown[]) => mockGetUsageSummary(...args),
}));

vi.mock("@/lib/navigator/scoring", () => ({
  calculateIcpScore: (...args: unknown[]) => mockCalculateIcpScore(...args),
}));

vi.mock("@/lib/navigator/llm/icpPrompts", () => ({
  extractICPCriteria: (...args: unknown[]) => mockExtractICPCriteria(...args),
  scoreCompaniesAgainstICP: (...args: unknown[]) => mockScoreCompaniesAgainstICP(...args),
}));

vi.mock("@/lib/navigator/exa/queryBuilder", () => ({
  reformulateQueryWithEntities: vi.fn(async (rawText: string) => ({
    queries: [rawText || "default query"],
    entities: { verticals: [], regions: [], signals: [] },
  })),
  looksLikeCompanyName: vi.fn((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return false;
    const stripped = trimmed.replace(/\b(SE|AG|GmbH|Ltd|Inc|Corp|LLC)\b\.?$/i, "").trim();
    const words = stripped.split(/\s+/);
    const descriptiveWords = [
      "companies", "company", "in", "for", "with", "hiring", "funding",
      "expanding", "industry", "sector", "region", "saas", "b2b", "b2c",
      "startups", "enterprises", "firms", "suppliers", "manufacturers",
      "distributors", "providers", "solutions", "services", "products",
    ];
    const lower = stripped.toLowerCase();
    const hasDescriptive = descriptiveWords.some((w) => lower.includes(w));
    return words.length <= 4 && !hasDescriptive;
  }),
  stripLegalSuffix: vi.fn((q: string) => q.replace(/\b(SE|AG|GmbH|Ltd|Inc|Corp|LLC)\b\.?$/i, "").trim()),
  simplifyQuery: vi.fn((q: string) => q.trim()),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "exclusions") {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "admin_config") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "search_history") {
        return {
          insert: vi.fn().mockReturnValue({
            then: vi.fn((cb: (v: unknown) => void) => cb({ error: null })),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Dynamic import of route handler
// ---------------------------------------------------------------------------

let POST: typeof import("@/app/api/search/companies/route").POST;

beforeEach(async () => {
  vi.stubEnv("EXA_API_KEY", "test-exa");
  vi.stubEnv("APOLLO_API_KEY", "test-apollo");
  vi.stubEnv("SERPER_API_KEY", "test-serper");
  vi.stubEnv("PARALLEL_API_KEY", "test-parallel");
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-key");

  // Reset all mocks
  mockSearchExa.mockReset();
  mockSearchSerper.mockReset();
  mockSearchParallel.mockReset();
  mockEnrichCompany.mockReset();
  mockFindContacts.mockReset();
  mockPickDiscoveryEngine.mockReset();
  mockPickNameEngine.mockReset();
  mockRecordUsage.mockReset();
  mockIsExaFallbackAllowed.mockReset();
  mockGetUsageSummary.mockReset();
  mockCalculateIcpScore.mockReset();
  mockExtractICPCriteria.mockReset();
  mockScoreCompaniesAgainstICP.mockReset();

  await clearCache();

  // Default mock implementations
  mockPickDiscoveryEngine.mockResolvedValue("parallel");
  mockPickNameEngine.mockResolvedValue("serper");
  mockIsExaFallbackAllowed.mockReturnValue(false);
  mockGetUsageSummary.mockReturnValue({
    exa: { count: 0, budget: 5, pctUsed: 0 },
    parallel: { count: 0, budget: 800, pctUsed: 0 },
    serper: { count: 0, budget: 100, pctUsed: 0 },
  });
  mockCalculateIcpScore.mockReturnValue({ score: 50, breakdown: [] });
  mockExtractICPCriteria.mockResolvedValue({
    description: "test",
    targetVerticals: [],
    targetRegions: [],
    targetSizeRange: null,
    buyingSignals: [],
    negativeSignals: [],
    qualitativeFactors: [],
  });
  mockScoreCompaniesAgainstICP.mockResolvedValue([]);
  mockEnrichCompany.mockResolvedValue(null);
  mockFindContacts.mockResolvedValue([]);

  vi.resetModules();
  const mod = await import("@/app/api/search/companies/route");
  POST = mod.POST;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/search/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCompany(domain: string, name: string, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    domain,
    name,
    firstViewedBy: "system",
    firstViewedAt: now,
    lastViewedBy: "system",
    lastViewedAt: now,
    source: "parallel",
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
    employeeCount: 100,
    location: "",
    region: "",
    description: `${name} description`,
    icpScore: 0,
    hubspotStatus: "none",
    freshsalesStatus: "none",
    freshsalesIntel: null,
    sources: ["parallel"],
    signals: [],
    contactCount: 0,
    lastRefreshed: now,
    website: `https://${domain}`,
    ...overrides,
  };
}

// ===========================================================================
// Empty request
// ===========================================================================

describe("POST /api/search/companies — empty request", () => {
  it("returns empty results when no filters or freeText", async () => {
    const res = await POST(makeRequest({}));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.companies).toEqual([]);
    expect(body.message).toContain("No search criteria");
  });
});

// ===========================================================================
// Discovery path (descriptive query -> Parallel engine)
// ===========================================================================

describe("POST /api/search/companies — discovery path (Parallel)", () => {
  it("routes discovery queries to Parallel engine", async () => {
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [
        makeCompany("acme.com", "Acme Corp"),
        makeCompany("beta.com", "Beta Inc"),
      ],
      signals: [],
      cacheHit: false,
      avgRelevance: 0.5,
    });

    const res = await POST(makeRequest({
      freeText: "mid-size food ingredients companies expanding to Asia",
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companies).toHaveLength(2);
    expect(body.searchEngine).toBe("parallel");
    expect(mockPickDiscoveryEngine).toHaveBeenCalled();
    expect(mockSearchParallel).toHaveBeenCalled();
    expect(mockSearchSerper).not.toHaveBeenCalled();
  });

  it("records usage for parallel engine when not a cache hit", async () => {
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [makeCompany("acme.com", "Acme")],
      signals: [],
      cacheHit: false,
      avgRelevance: 0.5,
    });

    await POST(makeRequest({ freeText: "chemical companies in Europe" }));
    expect(mockRecordUsage).toHaveBeenCalledWith("parallel");
  });

  it("does not record usage on cache hit", async () => {
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [makeCompany("acme.com", "Acme")],
      signals: [],
      cacheHit: true,
      avgRelevance: 0.5,
    });

    await POST(makeRequest({ freeText: "food companies" }));
    expect(mockRecordUsage).not.toHaveBeenCalledWith("parallel");
  });
});

// ===========================================================================
// Name query path (company name -> Serper engine)
// ===========================================================================

describe("POST /api/search/companies — name query path (Serper)", () => {
  it("routes company name queries to Serper engine", async () => {
    mockPickNameEngine.mockResolvedValue("serper");
    mockSearchSerper.mockResolvedValue({
      companies: [makeCompany("basf.com", "BASF SE", { source: "serper", sources: ["serper"] })],
      signals: [],
      cacheHit: false,
    });

    const res = await POST(makeRequest({ freeText: "BASF" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].domain).toBe("basf.com");
    expect(body.searchEngine).toBe("serper");
    expect(mockPickNameEngine).toHaveBeenCalled();
    expect(mockSearchSerper).toHaveBeenCalled();
    expect(mockSearchParallel).not.toHaveBeenCalled();
  });

  it("records usage for serper engine on non-cache hit", async () => {
    mockPickNameEngine.mockResolvedValue("serper");
    mockSearchSerper.mockResolvedValue({
      companies: [makeCompany("basf.com", "BASF")],
      signals: [],
      cacheHit: false,
    });

    await POST(makeRequest({ freeText: "BASF" }));
    expect(mockRecordUsage).toHaveBeenCalledWith("serper");
  });
});

// ===========================================================================
// Exa fallback when Serper returns empty
// ===========================================================================

describe("POST /api/search/companies — Exa fallback", () => {
  it("falls back to Exa when Serper returns 0 results and Exa budget allows", async () => {
    mockPickNameEngine.mockResolvedValue("serper");
    mockSearchSerper.mockResolvedValue({
      companies: [],
      signals: [],
      cacheHit: false,
    });
    mockIsExaFallbackAllowed.mockReturnValue(true);
    mockSearchExa.mockResolvedValue({
      companies: [makeCompany("basf.com", "BASF SE", { source: "exa", sources: ["exa"] })],
      signals: [],
      cacheHit: false,
    });

    const res = await POST(makeRequest({ freeText: "BASF" }));
    const body = await res.json();

    expect(body.companies).toHaveLength(1);
    expect(body.searchEngine).toBe("exa"); // engine changed to exa after fallback
    expect(mockSearchSerper).toHaveBeenCalled();
    expect(mockSearchExa).toHaveBeenCalled();
  });

  it("does not fall back to Exa when budget is exhausted", async () => {
    mockPickNameEngine.mockResolvedValue("serper");
    mockSearchSerper.mockResolvedValue({
      companies: [],
      signals: [],
      cacheHit: false,
    });
    mockIsExaFallbackAllowed.mockReturnValue(false);

    const res = await POST(makeRequest({ freeText: "BASF" }));
    const body = await res.json();

    expect(body.companies).toEqual([]);
    expect(mockSearchExa).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Apollo enrichment
// ===========================================================================

describe("POST /api/search/companies — Apollo enrichment", () => {
  it("enriches search results with Apollo data", async () => {
    const baseCompany = makeCompany("acme.com", "Acme Corp");
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [baseCompany],
      signals: [],
      cacheHit: false,
      avgRelevance: 0.5,
    });
    mockEnrichCompany.mockResolvedValue({
      name: "Acme Corporation",
      industry: "Technology",
      employeeCount: 500,
      location: "San Francisco, CA",
      region: "North America",
      description: "Leading tech company",
      website: "https://acme.com",
    });
    mockFindContacts.mockResolvedValue([
      { id: "c1", firstName: "Jane", lastName: "Doe", email: "jane@acme.com" },
    ]);

    const res = await POST(makeRequest({ freeText: "technology companies in San Francisco" }));
    const body = await res.json();

    expect(body.companies).toHaveLength(1);
    expect(mockEnrichCompany).toHaveBeenCalledWith("acme.com");
    expect(mockFindContacts).toHaveBeenCalledWith("acme.com");
  });
});

// ===========================================================================
// Exclusion filtering
// ===========================================================================

describe("POST /api/search/companies — exclusion filtering", () => {
  it("filters out excluded companies by domain", async () => {
    // Re-import POST with a custom supabase mock that returns exclusions
    vi.resetModules();

    // Override the supabase mock before importing the route
    vi.doMock("@/lib/supabase/server", () => ({
      createServerClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === "exclusions") {
            return {
              select: vi.fn().mockResolvedValue({
                data: [{ type: "domain", value: "excluded.com" }],
                error: null,
              }),
            };
          }
          if (table === "admin_config") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          // search_history
          return {
            insert: vi.fn().mockReturnValue({
              then: vi.fn((cb: (v: unknown) => void) => cb({ error: null })),
            }),
          };
        }),
      })),
    }));

    const { POST: localPOST } = await import("@/app/api/search/companies/route");

    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [
        makeCompany("acme.com", "Acme Corp"),
        makeCompany("excluded.com", "Excluded Corp"),
      ],
      signals: [],
      cacheHit: false,
      avgRelevance: 0.5,
    });

    const res = await localPOST(makeRequest({ freeText: "technology companies expanding globally" }));
    const body = await res.json();

    // Excluded company should be filtered out
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].domain).toBe("acme.com");
    expect(body.excludedCount).toBe(1);
  });
});

// ===========================================================================
// Response shape
// ===========================================================================

describe("POST /api/search/companies — response shape", () => {
  it("returns expected fields in response", async () => {
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [makeCompany("acme.com", "Acme Corp")],
      signals: [{ id: "s1", type: "hiring", title: "Hiring engineers" }],
      cacheHit: false,
      avgRelevance: 0.5,
    });

    const res = await POST(makeRequest({ freeText: "tech companies hiring engineers" }));
    const body = await res.json();

    expect(body).toHaveProperty("companies");
    expect(body).toHaveProperty("signals");
    expect(body).toHaveProperty("reformulatedQueries");
    expect(body).toHaveProperty("searchEngine");
    expect(body).toHaveProperty("usageSummary");
    expect(body).toHaveProperty("excludedCount");
    expect(Array.isArray(body.companies)).toBe(true);
    expect(Array.isArray(body.signals)).toBe(true);
    expect(Array.isArray(body.reformulatedQueries)).toBe(true);
  });

  it("includes usageSummary from smart router", async () => {
    const expectedSummary = {
      exa: { count: 1, budget: 5, pctUsed: 20 },
      parallel: { count: 3, budget: 800, pctUsed: 0 },
      serper: { count: 0, budget: 100, pctUsed: 0 },
    };
    mockGetUsageSummary.mockReturnValue(expectedSummary);
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [],
      signals: [],
      cacheHit: false,
      avgRelevance: 0,
    });

    const res = await POST(makeRequest({ freeText: "food companies in Asia" }));
    const body = await res.json();

    expect(body.usageSummary).toEqual(expectedSummary);
  });
});

// ===========================================================================
// ICP scoring
// ===========================================================================

describe("POST /api/search/companies — ICP scoring", () => {
  it("applies ICP scoring to all returned companies", async () => {
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [
        makeCompany("acme.com", "Acme Corp"),
        makeCompany("beta.com", "Beta Inc"),
      ],
      signals: [],
      cacheHit: false,
      avgRelevance: 0.5,
    });
    mockCalculateIcpScore
      .mockReturnValueOnce({ score: 85, breakdown: [{ factor: "vertical", points: 30, matched: true }] })
      .mockReturnValueOnce({ score: 45, breakdown: [{ factor: "vertical", points: 0, matched: false }] });

    const res = await POST(makeRequest({ freeText: "chemical companies in Europe hiring" }));
    const body = await res.json();

    expect(mockCalculateIcpScore).toHaveBeenCalledTimes(2);
    // Companies sorted by ICP score descending
    expect(body.companies[0].icpScore).toBe(85);
    expect(body.companies[1].icpScore).toBe(45);
  });
});

// ===========================================================================
// Dedup by root domain
// ===========================================================================

describe("POST /api/search/companies — dedup", () => {
  it("deduplicates companies by root domain, keeping higher employeeCount", async () => {
    mockPickDiscoveryEngine.mockResolvedValue("parallel");
    mockSearchParallel.mockResolvedValue({
      companies: [
        makeCompany("www.acme.com", "Acme (www)", { employeeCount: 50 }),
        makeCompany("acme.com", "Acme Corp", { employeeCount: 500 }),
      ],
      signals: [],
      cacheHit: false,
      avgRelevance: 0.5,
    });

    const res = await POST(makeRequest({ freeText: "technology companies with 500 employees" }));
    const body = await res.json();

    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].employeeCount).toBe(500);
  });
});
