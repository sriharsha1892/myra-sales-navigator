import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/session/team-activity/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/session/team-activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns merged and sorted activities from views and searches", async () => {
    const viewsData = [
      { domain: "acme.com", name: "Acme Corp", last_viewed_by: "Adi", last_viewed_at: "2026-02-04T12:00:00Z" },
      { domain: "beta.io", name: "Beta Inc", last_viewed_by: "Satish", last_viewed_at: "2026-02-04T10:00:00Z" },
    ];
    const searchesData = [
      { user_name: "Kirandeep", label: "Food companies", result_count: 25, created_at: "2026-02-04T11:00:00Z" },
    ];

    const viewsTable = fakeTable(viewsData);
    const searchesTable = fakeTable(searchesData);
    mockFrom
      .mockReturnValueOnce(viewsTable)
      .mockReturnValueOnce(searchesTable);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.activities).toHaveLength(3);

    // Should be sorted by timestamp descending
    expect(body.activities[0]).toEqual({
      type: "view",
      text: "Viewed Acme Corp",
      user: "Adi",
      at: "2026-02-04T12:00:00Z",
    });
    expect(body.activities[1]).toEqual({
      type: "search",
      text: 'Searched "Food companies" (25 results)',
      user: "Kirandeep",
      at: "2026-02-04T11:00:00Z",
    });
    expect(body.activities[2]).toEqual({
      type: "view",
      text: "Viewed Beta Inc",
      user: "Satish",
      at: "2026-02-04T10:00:00Z",
    });
  });

  it("returns empty activities array when no data exists", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toEqual([]);
  });

  it("limits merged activities to 10 entries", async () => {
    // 10 views + 10 searches = 20 total, should be trimmed to 10
    const viewsData = Array.from({ length: 10 }, (_, i) => ({
      domain: `company${i}.com`,
      name: `Company ${i}`,
      last_viewed_by: "Adi",
      last_viewed_at: `2026-02-04T${String(20 - i).padStart(2, "0")}:00:00Z`,
    }));
    const searchesData = Array.from({ length: 10 }, (_, i) => ({
      user_name: "Satish",
      label: `Search ${i}`,
      result_count: i * 5,
      created_at: `2026-02-03T${String(20 - i).padStart(2, "0")}:00:00Z`,
    }));

    mockFrom
      .mockReturnValueOnce(fakeTable(viewsData))
      .mockReturnValueOnce(fakeTable(searchesData));

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toHaveLength(10);
  });

  it("uses domain as fallback when company name is null", async () => {
    const viewsData = [
      { domain: "noname.io", name: null, last_viewed_by: "Adi", last_viewed_at: "2026-02-04T10:00:00Z" },
    ];

    mockFrom
      .mockReturnValueOnce(fakeTable(viewsData))
      .mockReturnValueOnce(fakeTable([]));

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities[0].text).toBe("Viewed noname.io");
  });

  it("returns empty activities array on unexpected error", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Connection timeout");
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toEqual([]);
  });
});
