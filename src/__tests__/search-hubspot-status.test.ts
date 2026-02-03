import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearCache } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Stub env before importing modules that read process.env at import time
// ---------------------------------------------------------------------------
vi.stubEnv("EXA_API_KEY", "test-exa-key");
vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "test-hubspot-token");

// ---------------------------------------------------------------------------
// Mock Supabase server client (used by exclusion list + search history)
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => {
  const chainable = {
    select: () => {
      const result = Promise.resolve({ data: [] });
      // Support both await and .eq().single() chaining
      (result as unknown as Record<string, unknown>).eq = () => ({
        single: () => Promise.resolve({ data: null }),
      });
      return result;
    },
    insert: () => ({
      then: (cb: (v: { error: null }) => void) => cb({ error: null }),
    }),
  };
  return {
    createServerClient: () => ({
      from: () => chainable,
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock Exa provider — return minimal company shells
// ---------------------------------------------------------------------------
vi.mock("@/lib/providers/exa", () => ({
  isExaAvailable: () => true,
  searchExa: vi.fn().mockResolvedValue({
    companies: [
      {
        id: "exa-1",
        name: "Acme Corp",
        domain: "acme.com",
        industry: "Tech",
        employeeCount: 100,
        location: "US",
        region: "North America",
        description: "A tech company",
        website: "https://acme.com",
        logoUrl: null,
        revenue: null,
        founded: null,
        sources: ["exa"],
        signals: [],
        hubspotStatus: "none",
        icpScore: 50,
        lastRefreshed: null,
      },
      {
        id: "exa-2",
        name: "Globex Inc",
        domain: "globex.com",
        industry: "Manufacturing",
        employeeCount: 500,
        location: "UK",
        region: "EMEA",
        description: "A manufacturing company",
        website: "https://globex.com",
        logoUrl: null,
        revenue: null,
        founded: null,
        sources: ["exa"],
        signals: [],
        hubspotStatus: "none",
        icpScore: 40,
        lastRefreshed: null,
      },
    ],
    signals: [],
  }),
}));

// ---------------------------------------------------------------------------
// Mock Apollo provider — skip enrichment to isolate test
// ---------------------------------------------------------------------------
vi.mock("@/lib/providers/apollo", () => ({
  isApolloAvailable: () => false,
  enrichCompany: vi.fn().mockResolvedValue(null),
  findContacts: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Mock query reformulation — return the query as-is
// ---------------------------------------------------------------------------
vi.mock("@/lib/exa/queryBuilder", () => ({
  reformulateQuery: vi.fn().mockResolvedValue(["test query"]),
  reformulateQueryWithEntities: vi.fn().mockResolvedValue({ queries: ["test query"], entities: { verticals: [], regions: [], signals: [] } }),
  looksLikeCompanyName: vi.fn().mockReturnValue(false),
}));

// ---------------------------------------------------------------------------
// Mock scoring + cache (used by search route for ICP scoring)
// ---------------------------------------------------------------------------
vi.mock("@/lib/scoring", () => ({
  calculateIcpScore: vi.fn().mockReturnValue({ score: 50, breakdown: [] }),
}));

vi.mock("@/lib/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  clearCache: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock HubSpot provider
// ---------------------------------------------------------------------------
const mockGetHubSpotStatus = vi.fn();
const mockIsHubSpotAvailable = vi.fn();

vi.mock("@/lib/providers/hubspot", () => ({
  isHubSpotAvailable: (...args: unknown[]) => mockIsHubSpotAvailable(...args),
  getHubSpotStatus: (...args: unknown[]) => mockGetHubSpotStatus(...args),
}));

// ---------------------------------------------------------------------------
// Import the route handler
// ---------------------------------------------------------------------------
const { POST } = await import("@/app/api/search/companies/route");

// ---------------------------------------------------------------------------
// Helper to build a fake Request
// ---------------------------------------------------------------------------
function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/search/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("search/companies route — HubSpot status NOT fetched during search", () => {
  beforeEach(async () => {
    await clearCache();
    mockGetHubSpotStatus.mockReset();
    mockIsHubSpotAvailable.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // HubSpot batch status was removed from search to avoid 429 rate limits.
  // Status is fetched in the dossier route when the user clicks a company.

  it("does not call getHubSpotStatus during search", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);

    await POST(makeRequest({ freeText: "test query" }));

    expect(mockGetHubSpotStatus).not.toHaveBeenCalled();
  });

  it("returns companies with default hubspotStatus from Exa", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.companies).toHaveLength(2);
    // Status stays at whatever Exa returned (default "none")
    expect(data.companies[0].hubspotStatus).toBe("none");
    expect(data.companies[1].hubspotStatus).toBe("none");
  });

  it("search succeeds regardless of HubSpot availability", async () => {
    mockIsHubSpotAvailable.mockReturnValue(false);

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.companies).toHaveLength(2);
    expect(mockGetHubSpotStatus).not.toHaveBeenCalled();
  });
});
