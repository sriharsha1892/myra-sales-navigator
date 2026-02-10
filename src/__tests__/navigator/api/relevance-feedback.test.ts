/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock fns
// ---------------------------------------------------------------------------

const { mockCookieGet, mockFrom } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockFrom: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — next/headers (cookies)
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

// ---------------------------------------------------------------------------
// Mocks — Supabase
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { POST, DELETE, GET } from "@/app/api/relevance-feedback/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function makeRequest(
  method: string,
  body?: Record<string, unknown>,
  url = "http://localhost/api/relevance-feedback"
): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

// ===========================================================================
// POST /api/relevance-feedback
// ===========================================================================

describe("POST /api/relevance-feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts feedback and returns { ok: true }", async () => {
    const chain = fakeTable(null);
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeRequest("POST", {
        domain: "acme.com",
        feedback: "not_relevant",
        reason: "wrong_industry",
        userName: "Satish",
        searchQuery: "food companies",
        companyIndustry: "Tech",
        companyRegion: "Europe",
        companySizeBucket: "51-200",
        icpScore: 42,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("relevance_feedback");
    expect(chain.upsert).toHaveBeenCalledWith(
      {
        domain: "acme.com",
        feedback: "not_relevant",
        reason: "wrong_industry",
        search_query: "food companies",
        user_name: "Satish",
        company_industry: "Tech",
        company_region: "Europe",
        company_size_bucket: "51-200",
        icp_score: 42,
      },
      { onConflict: "domain,user_name" }
    );
  });

  it("sets optional fields to null when not provided", async () => {
    const chain = fakeTable(null);
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeRequest("POST", {
        domain: "acme.com",
        feedback: "relevant",
        userName: "Adi",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: null,
        search_query: null,
        company_industry: null,
        company_region: null,
        company_size_bucket: null,
        icp_score: null,
      }),
      expect.anything()
    );
  });

  it("returns 400 when domain is missing", async () => {
    const res = await POST(
      makeRequest("POST", { feedback: "relevant", userName: "Adi" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 400 when feedback is missing", async () => {
    const res = await POST(
      makeRequest("POST", { domain: "acme.com", userName: "Adi" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 400 when userName is missing", async () => {
    const res = await POST(
      makeRequest("POST", { domain: "acme.com", feedback: "relevant" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 500 when Supabase upsert fails", async () => {
    const chain = fakeTable(null, { message: "upsert failed" });
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeRequest("POST", {
        domain: "acme.com",
        feedback: "relevant",
        userName: "Adi",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("upsert failed");
  });

  it("returns 500 on unexpected exception", async () => {
    // Pass a request that cannot be parsed as JSON
    const badReq = new Request("http://localhost/api/relevance-feedback", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(badReq);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal error");
  });
});

// ===========================================================================
// DELETE /api/relevance-feedback
// ===========================================================================

describe("DELETE /api/relevance-feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes feedback by domain and user and returns { deleted: true }", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === "user_name" ? { value: "Satish" } : undefined
    );
    const chain = fakeTable(null);
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(makeRequest("DELETE", { domain: "acme.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("relevance_feedback");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("domain", "acme.com");
    expect(chain.eq).toHaveBeenCalledWith("user_name", "Satish");
  });

  it("returns 400 when domain is missing", async () => {
    mockCookieGet.mockReturnValue({ value: "Adi" });

    const res = await DELETE(makeRequest("DELETE", {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing domain");
  });

  it("returns 401 when user_name cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await DELETE(makeRequest("DELETE", { domain: "acme.com" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 500 when Supabase delete fails", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === "user_name" ? { value: "Adi" } : undefined
    );
    const chain = fakeTable(null, { message: "delete failed" });
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(makeRequest("DELETE", { domain: "acme.com" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("delete failed");
  });
});

// ===========================================================================
// GET /api/relevance-feedback (user feedback — default mode)
// ===========================================================================

describe("GET /api/relevance-feedback (user mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user's feedback when authenticated", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === "user_name" ? { value: "Satish" } : undefined
    );

    const rows = [
      { domain: "acme.com", feedback: "not_relevant", reason: "wrong_size", created_at: "2026-02-10T01:00:00Z" },
      { domain: "beta.com", feedback: "relevant", reason: null, created_at: "2026-02-10T02:00:00Z" },
    ];
    const chain = fakeTable(rows);
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.feedback).toHaveLength(2);
    expect(body.feedback[0].domain).toBe("acme.com");
    expect(chain.select).toHaveBeenCalledWith("domain, feedback, reason, created_at");
    expect(chain.eq).toHaveBeenCalledWith("user_name", "Satish");
  });

  it("returns empty feedback array when no user_name cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.feedback).toEqual([]);
  });

  it("returns empty feedback on Supabase query error", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === "user_name" ? { value: "Adi" } : undefined
    );
    const chain = fakeTable(null, { message: "query failed" });
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.feedback).toEqual([]);
  });

  it("returns empty feedback when data is null", async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === "user_name" ? { value: "Adi" } : undefined
    );
    const chain = fakeTable(null);
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.feedback).toEqual([]);
  });
});

// ===========================================================================
// GET /api/relevance-feedback?aggregate=true (admin insights)
// ===========================================================================

describe("GET /api/relevance-feedback?aggregate=true", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregate stats from last N days", async () => {
    const rows = [
      { feedback: "relevant", reason: null, company_industry: "Tech", company_region: "North America", company_size_bucket: "51-200" },
      { feedback: "not_relevant", reason: "wrong_industry", company_industry: "Finance", company_region: "Europe", company_size_bucket: "1000+" },
      { feedback: "not_relevant", reason: "wrong_size", company_industry: "Finance", company_region: "Europe", company_size_bucket: "51-200" },
      { feedback: "not_relevant", reason: "wrong_industry", company_industry: "Tech", company_region: "Asia Pacific", company_size_bucket: "1000+" },
      { feedback: "relevant", reason: null, company_industry: "Food", company_region: "North America", company_size_bucket: "201-1000" },
    ];
    const chain = fakeTable(rows);
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback?aggregate=true&days=7")
    );
    const body = await res.json();

    expect(res.status).toBe(200);

    // Summary
    expect(body.summary.relevant).toBe(2);
    expect(body.summary.notRelevant).toBe(3);

    // Reasons — sorted by count desc; only from not_relevant rows
    expect(body.reasons).toEqual([
      { reason: "wrong_industry", count: 2 },
      { reason: "wrong_size", count: 1 },
    ]);

    // Top industries — from not_relevant only
    expect(body.topIndustries).toEqual([
      { value: "Finance", count: 2 },
      { value: "Tech", count: 1 },
    ]);

    // Top regions — from not_relevant only
    expect(body.topRegions).toEqual([
      { value: "Europe", count: 2 },
      { value: "Asia Pacific", count: 1 },
    ]);

    // Top sizes
    expect(body.topSizes).toEqual([
      { value: "1000+", count: 2 },
      { value: "51-200", count: 1 },
    ]);
  });

  it("limits top tables to 5 entries", async () => {
    // Build 7 distinct industries in not_relevant feedback
    const rows = Array.from({ length: 7 }, (_, i) => ({
      feedback: "not_relevant",
      reason: "wrong_industry",
      company_industry: `Industry-${i}`,
      company_region: `Region-${i}`,
      company_size_bucket: `Size-${i}`,
    }));
    const chain = fakeTable(rows);
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback?aggregate=true&days=30")
    );
    const body = await res.json();

    expect(body.topIndustries.length).toBeLessThanOrEqual(5);
    expect(body.topRegions.length).toBeLessThanOrEqual(5);
    expect(body.topSizes.length).toBeLessThanOrEqual(5);
  });

  it("uses gte filter with cutoff date based on days param", async () => {
    const chain = fakeTable([]);
    mockFrom.mockReturnValue(chain);

    const before = Date.now();
    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback?aggregate=true&days=14")
    );
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(chain.gte).toHaveBeenCalled();
    // Verify the cutoff is approximately 14 days ago
    const call = (chain.gte as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("created_at");
    const cutoffMs = new Date(call[1]).getTime();
    const expectedMin = before - 14 * 86400000;
    const expectedMax = after - 14 * 86400000;
    expect(cutoffMs).toBeGreaterThanOrEqual(expectedMin - 1000);
    expect(cutoffMs).toBeLessThanOrEqual(expectedMax + 1000);
  });

  it("defaults days to 7 when not provided", async () => {
    const chain = fakeTable([]);
    mockFrom.mockReturnValue(chain);

    const before = Date.now();
    await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback?aggregate=true")
    );

    const call = (chain.gte as ReturnType<typeof vi.fn>).mock.calls[0];
    const cutoffMs = new Date(call[1]).getTime();
    const expected = before - 7 * 86400000;
    expect(cutoffMs).toBeGreaterThanOrEqual(expected - 1000);
    expect(cutoffMs).toBeLessThanOrEqual(expected + 1000);
  });

  it("returns empty aggregate on Supabase error", async () => {
    const chain = fakeTable(null, { message: "aggregate failed" });
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback?aggregate=true&days=7")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toEqual({ relevant: 0, notRelevant: 0 });
    expect(body.reasons).toEqual([]);
    expect(body.topIndustries).toEqual([]);
    expect(body.topRegions).toEqual([]);
    expect(body.topSizes).toEqual([]);
  });

  it("handles rows with null fields gracefully", async () => {
    const rows = [
      { feedback: "not_relevant", reason: null, company_industry: null, company_region: null, company_size_bucket: null },
      { feedback: "not_relevant", reason: "wrong_size", company_industry: null, company_region: "Europe", company_size_bucket: null },
    ];
    const chain = fakeTable(rows);
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback?aggregate=true&days=7")
    );
    const body = await res.json();

    expect(body.summary.notRelevant).toBe(2);
    // Null reasons are skipped
    expect(body.reasons).toEqual([{ reason: "wrong_size", count: 1 }]);
    // Null industries are skipped
    expect(body.topIndustries).toEqual([]);
    // Only non-null region counted
    expect(body.topRegions).toEqual([{ value: "Europe", count: 1 }]);
  });

  it("handles empty rows (no feedback at all)", async () => {
    const chain = fakeTable([]);
    mockFrom.mockReturnValue(chain);

    const res = await GET(
      makeRequest("GET", undefined, "http://localhost/api/relevance-feedback?aggregate=true&days=7")
    );
    const body = await res.json();

    expect(body.summary).toEqual({ relevant: 0, notRelevant: 0 });
    expect(body.reasons).toEqual([]);
  });
});
