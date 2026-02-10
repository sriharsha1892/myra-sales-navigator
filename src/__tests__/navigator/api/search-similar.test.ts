/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock fns
// ---------------------------------------------------------------------------

const { mockCookieGet, mockSearchExa, mockIsExaAvailable, mockGetCached, mockSetCached, mockHashFilters, mockGetRootDomain, mockTrackUsage } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockSearchExa: vi.fn(),
  mockIsExaAvailable: vi.fn(),
  mockGetCached: vi.fn(),
  mockSetCached: vi.fn(),
  mockHashFilters: vi.fn(),
  mockGetRootDomain: vi.fn(),
  mockTrackUsage: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

vi.mock("@/lib/navigator/providers/exa", () => ({
  searchExa: mockSearchExa,
  isExaAvailable: mockIsExaAvailable,
}));

vi.mock("@/lib/cache", () => ({
  getCached: mockGetCached,
  setCached: mockSetCached,
  hashFilters: mockHashFilters,
  getRootDomain: mockGetRootDomain,
}));

vi.mock("@/lib/navigator/cache-config", () => ({
  CACHE_TTLS: { peers: 60 },
}));

vi.mock("@/lib/navigator/analytics-server", () => ({
  trackUsageEventServer: mockTrackUsage,
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/search/similar/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCompany(domain: string, name: string) {
  return {
    domain,
    name,
    industry: "Tech",
    region: "North America",
    employeeCount: 100,
    sources: ["exa"],
    signals: [],
    icpScore: 70,
    hubspotStatus: "none",
    freshsalesStatus: "none",
    vertical: "Tech",
    description: "",
    excluded: false,
  };
}

function makeRequest(body?: unknown): Request {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request("http://localhost/api/search/similar", init);
}

// ===========================================================================
// Tests
// ===========================================================================

describe("POST /api/search/similar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults
    mockCookieGet.mockImplementation((name: string) =>
      name === "user_name" ? { value: "Satish" } : undefined
    );
    mockIsExaAvailable.mockReturnValue(true);
    mockGetCached.mockResolvedValue(null);
    mockSetCached.mockResolvedValue(undefined);
    mockHashFilters.mockReturnValue("hash123");
    mockGetRootDomain.mockImplementation((d: string) => d.replace(/^www\./, ""));
    mockTrackUsage.mockImplementation(() => {});
  });

  // --- Auth ----------------------------------------------------------------

  it("returns 401 when user_name cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });

  // --- Validation ----------------------------------------------------------

  it("returns 400 for invalid JSON body", async () => {
    const badReq = new Request("http://localhost/api/search/similar", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(badReq);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid request body");
  });

  it("returns 400 when domain is missing", async () => {
    const res = await POST(makeRequest({ name: "Acme Corp" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("domain and name are required");
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({ domain: "acme.com" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("domain and name are required");
  });

  // --- Cache hit -----------------------------------------------------------

  it("returns cached results when available", async () => {
    const cached = { companies: [makeCompany("beta.com", "Beta Corp")] };
    mockGetCached.mockResolvedValue(cached);

    const res = await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].domain).toBe("beta.com");
    // Should NOT call searchExa when cache hits
    expect(mockSearchExa).not.toHaveBeenCalled();
  });

  // --- Exa unavailable -----------------------------------------------------

  it("returns empty companies array when Exa is not available", async () => {
    mockIsExaAvailable.mockReturnValue(false);

    const res = await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companies).toEqual([]);
    expect(mockSearchExa).not.toHaveBeenCalled();
  });

  // --- Happy path ----------------------------------------------------------

  it("calls searchExa with built query and returns filtered results", async () => {
    const exaResults = {
      companies: [
        makeCompany("beta.com", "Beta Corp"),
        makeCompany("acme.com", "Acme Corp"), // seed domain — should be filtered
        makeCompany("gamma.com", "Gamma Inc"),
      ],
      signals: [],
    };
    mockSearchExa.mockResolvedValue(exaResults);

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        name: "Acme Corp",
        industry: "SaaS",
        region: "North America",
        employeeCount: 200,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    // Seed domain filtered out
    expect(body.companies).toHaveLength(2);
    expect(body.companies.map((c: { domain: string }) => c.domain)).toEqual(["beta.com", "gamma.com"]);

    // Verify query construction
    expect(mockSearchExa).toHaveBeenCalledWith({
      query: "companies similar to Acme Corp in SaaS in North America with approximately 200 employees",
      numResults: 10,
    });
  });

  it("builds minimal query when only domain and name provided", async () => {
    mockSearchExa.mockResolvedValue({ companies: [], signals: [] });

    await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));

    expect(mockSearchExa).toHaveBeenCalledWith({
      query: "companies similar to Acme Corp",
      numResults: 10,
    });
  });

  it("caches results after successful search", async () => {
    mockSearchExa.mockResolvedValue({
      companies: [makeCompany("beta.com", "Beta Corp")],
      signals: [],
    });

    await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));

    expect(mockSetCached).toHaveBeenCalledWith(
      "similar:hash123",
      { companies: [expect.objectContaining({ domain: "beta.com" })] },
      60 // CACHE_TTLS.peers
    );
  });

  it("tracks usage event after successful search", async () => {
    mockSearchExa.mockResolvedValue({
      companies: [makeCompany("beta.com", "Beta Corp")],
      signals: [],
    });

    await POST(
      makeRequest({
        domain: "acme.com",
        name: "Acme Corp",
        industry: "SaaS",
      })
    );

    expect(mockTrackUsage).toHaveBeenCalledWith(
      "find_similar",
      "Satish",
      { domain: "acme.com", industry: "SaaS" }
    );
  });

  // --- Seed domain filtering -----------------------------------------------

  it("filters out seed domain using getRootDomain normalization", async () => {
    // Simulate getRootDomain stripping subdomains
    mockGetRootDomain.mockImplementation((d: string) => {
      if (d === "www.acme.com" || d === "acme.com") return "acme.com";
      return d;
    });

    mockSearchExa.mockResolvedValue({
      companies: [
        makeCompany("www.acme.com", "Acme Corp"), // variant of seed
        makeCompany("beta.com", "Beta Corp"),
      ],
      signals: [],
    });

    const res = await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));
    const body = await res.json();

    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].domain).toBe("beta.com");
  });

  it("limits results to 10 after filtering", async () => {
    const companies = Array.from({ length: 15 }, (_, i) =>
      makeCompany(`company-${i}.com`, `Company ${i}`)
    );
    mockSearchExa.mockResolvedValue({ companies, signals: [] });

    const res = await POST(makeRequest({ domain: "seed.com", name: "Seed Co" }));
    const body = await res.json();

    expect(body.companies.length).toBeLessThanOrEqual(10);
  });

  // --- Error handling (graceful degradation) -------------------------------

  it("returns empty companies array on searchExa error", async () => {
    mockSearchExa.mockRejectedValue(new Error("Exa API timeout"));

    const res = await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companies).toEqual([]);
  });

  it("does not fail when setCached rejects", async () => {
    mockSearchExa.mockResolvedValue({
      companies: [makeCompany("beta.com", "Beta Corp")],
      signals: [],
    });
    mockSetCached.mockRejectedValue(new Error("Cache write failed"));

    const res = await POST(makeRequest({ domain: "acme.com", name: "Acme Corp" }));
    const body = await res.json();

    // Should still return results despite cache failure
    expect(res.status).toBe(200);
    expect(body.companies).toHaveLength(1);
  });
});
