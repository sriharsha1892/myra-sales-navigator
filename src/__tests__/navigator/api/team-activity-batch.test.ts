import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { POST } from "@/app/api/team-activity/batch/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/team-activity/batch", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/team-activity/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Empty / missing input → {}
  // -----------------------------------------------------------------------

  it("returns {} when domains array is empty", async () => {
    const res = await POST(makeRequest({ domains: [], currentUser: "Adi" }));
    const body = await res.json();
    expect(body).toEqual({});
  });

  it("returns {} when domains is missing", async () => {
    const res = await POST(makeRequest({ currentUser: "Adi" }));
    const body = await res.json();
    expect(body).toEqual({});
  });

  it("returns {} when currentUser is missing", async () => {
    const res = await POST(makeRequest({ domains: ["acme.com"] }));
    const body = await res.json();
    expect(body).toEqual({});
  });

  // -----------------------------------------------------------------------
  // Grouped activity per domain
  // -----------------------------------------------------------------------

  it("returns grouped activity per domain (viewers, exporters, decisions)", async () => {
    const data = [
      {
        company_domain: "acme.com",
        user_name: "Satish",
        activity_type: "view",
        metadata: {},
        created_at: "2026-02-09T10:00:00Z",
      },
      {
        company_domain: "acme.com",
        user_name: "Nikita",
        activity_type: "export",
        metadata: { contactCount: 3 },
        created_at: "2026-02-09T09:00:00Z",
      },
      {
        company_domain: "acme.com",
        user_name: "Kirandeep",
        activity_type: "triage",
        metadata: { decision: "interested" },
        created_at: "2026-02-09T08:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(body["acme.com"]).toBeDefined();
    expect(body["acme.com"].viewers).toEqual([
      { user: "Satish", at: "2026-02-09T10:00:00Z" },
    ]);
    expect(body["acme.com"].exporters).toEqual([
      { user: "Nikita", at: "2026-02-09T09:00:00Z", count: 3 },
    ]);
    expect(body["acme.com"].decisions).toEqual([
      { user: "Kirandeep", decision: "interested", at: "2026-02-09T08:00:00Z" },
    ]);
  });

  // -----------------------------------------------------------------------
  // Excludes currentUser from results (via Supabase .neq)
  // -----------------------------------------------------------------------

  it("passes currentUser to neq filter to exclude self", async () => {
    const table = fakeTable([]);
    mockFrom.mockReturnValue(table);

    await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );

    expect(table.neq).toHaveBeenCalledWith("user_name", "Adi");
  });

  // -----------------------------------------------------------------------
  // Deduplication: same user per activity type keeps first occurrence
  // -----------------------------------------------------------------------

  it("deduplicates same user per activity type (keeps first/most recent)", async () => {
    const data = [
      {
        company_domain: "acme.com",
        user_name: "Satish",
        activity_type: "view",
        metadata: {},
        created_at: "2026-02-09T12:00:00Z",
      },
      {
        company_domain: "acme.com",
        user_name: "Satish",
        activity_type: "view",
        metadata: {},
        created_at: "2026-02-09T08:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    // Only one entry for Satish despite two view rows
    expect(body["acme.com"].viewers).toHaveLength(1);
    expect(body["acme.com"].viewers[0].user).toBe("Satish");
    // The first row (most recent due to order desc) is kept
    expect(body["acme.com"].viewers[0].at).toBe("2026-02-09T12:00:00Z");
  });

  // -----------------------------------------------------------------------
  // Caps each array at 5 entries
  // -----------------------------------------------------------------------

  it("caps each array at 5 entries", async () => {
    const data = Array.from({ length: 8 }, (_, i) => ({
      company_domain: "acme.com",
      user_name: `User${i}`,
      activity_type: "view",
      metadata: {},
      created_at: `2026-02-09T${String(10 + i).padStart(2, "0")}:00:00Z`,
    }));

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(body["acme.com"].viewers).toHaveLength(5);
  });

  // -----------------------------------------------------------------------
  // Extracts metadata fields
  // -----------------------------------------------------------------------

  it("extracts metadata.contactCount for exporters", async () => {
    const data = [
      {
        company_domain: "acme.com",
        user_name: "Satish",
        activity_type: "export",
        metadata: { contactCount: 7 },
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(body["acme.com"].exporters[0].count).toBe(7);
  });

  it("extracts metadata.decision for decisions", async () => {
    const data = [
      {
        company_domain: "acme.com",
        user_name: "Satish",
        activity_type: "triage",
        metadata: { decision: "pass" },
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(body["acme.com"].decisions[0].decision).toBe("pass");
  });

  // -----------------------------------------------------------------------
  // Handles null metadata gracefully
  // -----------------------------------------------------------------------

  it("handles null metadata gracefully (defaults count to 0, decision to 'unknown')", async () => {
    const data = [
      {
        company_domain: "acme.com",
        user_name: "Satish",
        activity_type: "export",
        metadata: null,
        created_at: "2026-02-09T10:00:00Z",
      },
      {
        company_domain: "acme.com",
        user_name: "Nikita",
        activity_type: "triage",
        metadata: null,
        created_at: "2026-02-09T09:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(body["acme.com"].exporters[0].count).toBe(0);
    expect(body["acme.com"].decisions[0].decision).toBe("unknown");
  });

  // -----------------------------------------------------------------------
  // Returns {} on Supabase query error
  // -----------------------------------------------------------------------

  it("returns {} on Supabase query error", async () => {
    mockFrom.mockReturnValue(fakeTable(null, { message: "DB error" }));

    const res = await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(body).toEqual({});
  });

  // -----------------------------------------------------------------------
  // Filters to last 7 days
  // -----------------------------------------------------------------------

  it("passes 7-day-ago ISO string to gte filter", async () => {
    const table = fakeTable([]);
    mockFrom.mockReturnValue(table);

    const before = Date.now();
    await POST(
      makeRequest({ domains: ["acme.com"], currentUser: "Adi" })
    );
    const after = Date.now();

    // gte should have been called with "created_at" and a date string
    expect(table.gte).toHaveBeenCalledWith(
      "created_at",
      expect.any(String)
    );

    const gteArg = (table.gte as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const gteDate = new Date(gteArg).getTime();
    const sevenDaysBefore = before - 7 * 86400000;
    const sevenDaysAfter = after - 7 * 86400000;
    // The gte date should be approximately 7 days before now
    expect(gteDate).toBeGreaterThanOrEqual(sevenDaysBefore - 1000);
    expect(gteDate).toBeLessThanOrEqual(sevenDaysAfter + 1000);
  });

  // -----------------------------------------------------------------------
  // Multiple domains return separate summaries
  // -----------------------------------------------------------------------

  it("multiple domains return separate summaries", async () => {
    const data = [
      {
        company_domain: "acme.com",
        user_name: "Satish",
        activity_type: "view",
        metadata: {},
        created_at: "2026-02-09T10:00:00Z",
      },
      {
        company_domain: "beta.io",
        user_name: "Nikita",
        activity_type: "export",
        metadata: { contactCount: 2 },
        created_at: "2026-02-09T09:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await POST(
      makeRequest({ domains: ["acme.com", "beta.io"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(Object.keys(body)).toHaveLength(2);
    expect(body["acme.com"].viewers).toHaveLength(1);
    expect(body["acme.com"].exporters).toHaveLength(0);
    expect(body["beta.io"].exporters).toHaveLength(1);
    expect(body["beta.io"].viewers).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Empty result set produces no keys for empty domains
  // -----------------------------------------------------------------------

  it("empty result set returns {} (no keys for domains with no activity)", async () => {
    mockFrom.mockReturnValue(fakeTable([]));

    const res = await POST(
      makeRequest({ domains: ["ghost.com"], currentUser: "Adi" })
    );
    const body = await res.json();

    expect(body).toEqual({});
    expect(body["ghost.com"]).toBeUndefined();
  });
});
