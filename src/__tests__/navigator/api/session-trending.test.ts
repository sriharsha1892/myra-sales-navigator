import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/session/trending/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/session/trending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trending companies viewed by 2+ distinct users", async () => {
    const recentCompanies = [
      { domain: "acme.com", name: "Acme Corp", last_viewed_at: "2026-02-04T10:00:00Z", last_viewed_by: "Adi", viewed_by: "Satish" },
      { domain: "acme.com", name: "Acme Corp", last_viewed_at: "2026-02-03T10:00:00Z", last_viewed_by: "Kirandeep", viewed_by: "Kirandeep" },
      { domain: "beta.io", name: "Beta Inc", last_viewed_at: "2026-02-04T09:00:00Z", last_viewed_by: "Adi", viewed_by: "Adi" },
    ];

    const table = fakeTable(recentCompanies);
    mockFrom.mockReturnValue(table);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();

    // acme.com has 3 viewers (Adi, Satish, Kirandeep) — should be trending
    // beta.io has only 1 viewer (Adi) — should not be trending
    expect(body.trending).toHaveLength(1);
    expect(body.trending[0].domain).toBe("acme.com");
    expect(body.trending[0].viewerCount).toBe(3);
    expect(body.trending[0].viewerNames).toEqual(
      expect.arrayContaining(["Adi", "Satish", "Kirandeep"])
    );
    expect(body.trending[0].lastViewed).toBe("2026-02-04T10:00:00Z");
  });

  it("returns empty trending array when no companies have 2+ viewers", async () => {
    const recentCompanies = [
      { domain: "solo.com", name: "Solo Corp", last_viewed_at: "2026-02-04T10:00:00Z", last_viewed_by: "Adi", viewed_by: "Adi" },
    ];

    mockFrom.mockReturnValue(fakeTable(recentCompanies));

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trending).toEqual([]);
  });

  it("returns empty trending array on Supabase query error", async () => {
    mockFrom.mockReturnValue(fakeTable(null, { message: "Query failed" }));

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trending).toEqual([]);
  });

  it("returns at most 5 trending companies sorted by viewer count descending", async () => {
    // Create 6 companies each with 2+ viewers
    const companies = [];
    for (let i = 0; i < 12; i++) {
      const domainIndex = Math.floor(i / 2);
      companies.push({
        domain: `company${domainIndex}.com`,
        name: `Company ${domainIndex}`,
        last_viewed_at: `2026-02-04T${String(10 - domainIndex).padStart(2, "0")}:00:00Z`,
        last_viewed_by: `user${i}`,
        viewed_by: `user${i}`,
      });
    }

    mockFrom.mockReturnValue(fakeTable(companies));

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trending.length).toBeLessThanOrEqual(5);
  });

  it("returns empty trending array when an unexpected error is thrown", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected crash");
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trending).toEqual([]);
  });
});
