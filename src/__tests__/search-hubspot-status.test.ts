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
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [] }),
      insert: () => ({
        then: (cb: (v: { error: null }) => void) => cb({ error: null }),
      }),
    }),
  }),
}));

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
// Mock Apollo provider — skip enrichment to isolate HubSpot test
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
}));

// ---------------------------------------------------------------------------
// Mock HubSpot provider — this is what we're actually testing
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

describe("search/companies route — HubSpot status enrichment", () => {
  beforeEach(async () => {
    await clearCache();
    mockGetHubSpotStatus.mockReset();
    mockIsHubSpotAvailable.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Happy path: HubSpot available, returns statuses
  // -----------------------------------------------------------------------

  it("merges HubSpot status onto companies when available", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);
    mockGetHubSpotStatus
      .mockResolvedValueOnce({
        domain: "acme.com",
        status: "in_progress",
        lastContact: "2026-01-15",
        dealStage: "qualifiedtobuy",
      })
      .mockResolvedValueOnce({
        domain: "globex.com",
        status: "closed_won",
        lastContact: "2025-12-01",
        dealStage: "closedwon",
      });

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    expect(data.companies).toHaveLength(2);
    expect(data.companies[0].hubspotStatus).toBe("in_progress");
    expect(data.companies[1].hubspotStatus).toBe("closed_won");
  });

  it("calls getHubSpotStatus for each company domain", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);
    mockGetHubSpotStatus.mockResolvedValue({
      domain: "any.com",
      status: "none",
      lastContact: null,
      dealStage: null,
    });

    await POST(makeRequest({ freeText: "test query" }));

    expect(mockGetHubSpotStatus).toHaveBeenCalledTimes(2);
    expect(mockGetHubSpotStatus).toHaveBeenCalledWith("acme.com");
    expect(mockGetHubSpotStatus).toHaveBeenCalledWith("globex.com");
  });

  // -----------------------------------------------------------------------
  // HubSpot status "none" — should NOT overwrite default
  // -----------------------------------------------------------------------

  it("keeps hubspotStatus as 'none' when HubSpot returns 'none'", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);
    mockGetHubSpotStatus.mockResolvedValue({
      domain: "any.com",
      status: "none",
      lastContact: null,
      dealStage: null,
    });

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    expect(data.companies[0].hubspotStatus).toBe("none");
    expect(data.companies[1].hubspotStatus).toBe("none");
  });

  // -----------------------------------------------------------------------
  // Mixed statuses — some "none", some real
  // -----------------------------------------------------------------------

  it("only updates companies that have a real HubSpot status", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);
    mockGetHubSpotStatus
      .mockResolvedValueOnce({
        domain: "acme.com",
        status: "new",
        lastContact: null,
        dealStage: null,
      })
      .mockResolvedValueOnce({
        domain: "globex.com",
        status: "none",
        lastContact: null,
        dealStage: null,
      });

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    expect(data.companies[0].hubspotStatus).toBe("new");
    expect(data.companies[1].hubspotStatus).toBe("none");
  });

  // -----------------------------------------------------------------------
  // HubSpot unavailable — skip entirely
  // -----------------------------------------------------------------------

  it("skips HubSpot fetch when HUBSPOT_ACCESS_TOKEN not configured", async () => {
    mockIsHubSpotAvailable.mockReturnValue(false);

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    expect(mockGetHubSpotStatus).not.toHaveBeenCalled();
    expect(data.companies[0].hubspotStatus).toBe("none");
    expect(data.companies[1].hubspotStatus).toBe("none");
  });

  // -----------------------------------------------------------------------
  // Graceful failure — individual HubSpot lookups fail
  // -----------------------------------------------------------------------

  it("does not fail search when individual HubSpot calls reject", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);
    mockGetHubSpotStatus
      .mockRejectedValueOnce(new Error("HubSpot rate limit"))
      .mockResolvedValueOnce({
        domain: "globex.com",
        status: "closed_won",
        lastContact: null,
        dealStage: null,
      });

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    // First company: failed lookup, status stays "none"
    expect(data.companies[0].hubspotStatus).toBe("none");
    // Second company: successful lookup
    expect(data.companies[1].hubspotStatus).toBe("closed_won");
    // Search itself succeeds (200)
    expect(res.status).toBe(200);
  });

  it("does not fail search when ALL HubSpot calls reject", async () => {
    mockIsHubSpotAvailable.mockReturnValue(true);
    mockGetHubSpotStatus.mockRejectedValue(new Error("HubSpot down"));

    const res = await POST(makeRequest({ freeText: "test query" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.companies).toHaveLength(2);
    expect(data.companies[0].hubspotStatus).toBe("none");
    expect(data.companies[1].hubspotStatus).toBe("none");
  });
});
