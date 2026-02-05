import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/session/resume/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/session/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when user param is missing", async () => {
    const req = new NextRequest("http://localhost/api/session/resume");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("user param required");
  });

  it("returns recent companies, searches, and in-progress items for a given user", async () => {
    const companiesData = [
      { domain: "acme.com", name: "Acme Corp", status: "qualified", last_viewed_at: "2026-02-01T10:00:00Z" },
    ];
    const searchesData = [
      { id: "s1", label: "Food companies", filters: { verticals: ["food"] }, result_count: 12, created_at: "2026-02-01T09:00:00Z" },
    ];
    const inProgressData = [
      { domain: "beta.io", name: "Beta Inc", status: "researching", status_changed_at: "2026-01-30T08:00:00Z" },
    ];

    // The route calls sb.from() three times: companies, search_history, companies
    const companiesTable = fakeTable(companiesData);
    const searchesTable = fakeTable(searchesData);
    const inProgressTable = fakeTable(inProgressData);
    mockFrom
      .mockReturnValueOnce(companiesTable)
      .mockReturnValueOnce(searchesTable)
      .mockReturnValueOnce(inProgressTable);

    const req = new NextRequest("http://localhost/api/session/resume?user=Adi");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.recentCompanies).toEqual(companiesData);
    expect(body.recentSearches).toEqual([
      {
        id: "s1",
        label: "Food companies",
        filters: { verticals: ["food"] },
        resultCount: 12,
        timestamp: "2026-02-01T09:00:00Z",
      },
    ]);
    expect(body.inProgress).toEqual(inProgressData);

    // Verify correct tables queried
    expect(mockFrom).toHaveBeenCalledWith("companies");
    expect(mockFrom).toHaveBeenCalledWith("search_history");
  });

  it("returns empty arrays when no data exists", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const req = new NextRequest("http://localhost/api/session/resume?user=Satish");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.recentCompanies).toEqual([]);
    expect(body.recentSearches).toEqual([]);
    expect(body.inProgress).toEqual([]);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const req = new NextRequest("http://localhost/api/session/resume?user=Adi");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal error");
  });

  it("filters companies by last_viewed_by matching the user param", async () => {
    const table = fakeTable([]);
    mockFrom.mockReturnValue(table);

    const req = new NextRequest("http://localhost/api/session/resume?user=Kirandeep");
    await GET(req);

    // First call is for recentCompanies
    expect(mockFrom).toHaveBeenNthCalledWith(1, "companies");
    expect(table.eq).toHaveBeenCalledWith("last_viewed_by", "Kirandeep");
  });
});
