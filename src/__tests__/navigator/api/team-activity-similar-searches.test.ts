import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/team-activity/similar-searches/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/team-activity/similar-searches");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/team-activity/similar-searches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Missing parameters → { match: null }
  // -----------------------------------------------------------------------

  it("returns { match: null } when no query param", async () => {
    const res = await GET(makeRequest({ user: "Adi" }));
    const body = await res.json();
    expect(body).toEqual({ match: null });
  });

  it("returns { match: null } when no user param", async () => {
    const res = await GET(makeRequest({ query: "food ingredients" }));
    const body = await res.json();
    expect(body).toEqual({ match: null });
  });

  it("returns { match: null } when both params are missing", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body).toEqual({ match: null });
  });

  // -----------------------------------------------------------------------
  // No search history data → { match: null }
  // -----------------------------------------------------------------------

  it("returns { match: null } when no search history data", async () => {
    mockFrom.mockReturnValue(fakeTable([]));

    const res = await GET(
      makeRequest({ query: "food ingredients", user: "Adi" })
    );
    const body = await res.json();
    expect(body).toEqual({ match: null });
  });

  it("returns { match: null } when data is null", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const res = await GET(
      makeRequest({ query: "food ingredients", user: "Adi" })
    );
    const body = await res.json();
    expect(body).toEqual({ match: null });
  });

  // -----------------------------------------------------------------------
  // High similarity → returns match
  // -----------------------------------------------------------------------

  it("returns match when high similarity (nearly identical queries)", async () => {
    const data = [
      {
        user_name: "Satish",
        label: "food ingredients manufacturing",
        result_count: 15,
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await GET(
      makeRequest({ query: "food ingredients manufacturing", user: "Adi" })
    );
    const body = await res.json();

    expect(body.match).not.toBeNull();
    expect(body.match.user).toBe("Satish");
    expect(body.match.query).toBe("food ingredients manufacturing");
    expect(body.match.at).toBe("2026-02-09T10:00:00Z");
    expect(body.match.resultCount).toBe(15);
  });

  // -----------------------------------------------------------------------
  // Dissimilar queries → no match (below 0.35 threshold)
  // -----------------------------------------------------------------------

  it("returns { match: null } when queries are dissimilar (below 0.35 threshold)", async () => {
    const data = [
      {
        user_name: "Satish",
        label: "automotive parts suppliers Japan",
        result_count: 10,
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    // Completely unrelated query
    const res = await GET(
      makeRequest({ query: "healthcare SaaS startups Europe", user: "Adi" })
    );
    const body = await res.json();

    expect(body.match).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Best match among multiple candidates
  // -----------------------------------------------------------------------

  it("returns best match among multiple candidates", async () => {
    const data = [
      {
        user_name: "Satish",
        label: "food ingredients manufacturing India",
        result_count: 20,
        created_at: "2026-02-09T10:00:00Z",
      },
      {
        user_name: "Nikita",
        label: "food ingredients wholesale Europe",
        result_count: 12,
        created_at: "2026-02-09T09:00:00Z",
      },
      {
        user_name: "Kirandeep",
        label: "automotive parts Japan",
        result_count: 8,
        created_at: "2026-02-09T08:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    // Query closely matches the first entry (shares "food", "ingredients", "India")
    const res = await GET(
      makeRequest({
        query: "food ingredients suppliers India",
        user: "Adi",
      })
    );
    const body = await res.json();

    expect(body.match).not.toBeNull();
    // Should match Satish's query (best Jaccard overlap with "food", "ingredients", "India")
    expect(body.match.user).toBe("Satish");
  });

  // -----------------------------------------------------------------------
  // Skips entries with null label
  // -----------------------------------------------------------------------

  it("skips entries with null label", async () => {
    const data = [
      {
        user_name: "Satish",
        label: null,
        result_count: 10,
        created_at: "2026-02-09T10:00:00Z",
      },
      {
        user_name: "Nikita",
        label: "food ingredients manufacturing",
        result_count: 15,
        created_at: "2026-02-09T09:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await GET(
      makeRequest({ query: "food ingredients manufacturing", user: "Adi" })
    );
    const body = await res.json();

    // Should skip null label and match Nikita
    expect(body.match).not.toBeNull();
    expect(body.match.user).toBe("Nikita");
  });

  // -----------------------------------------------------------------------
  // Excludes self (same user_name) — via Supabase .neq
  // -----------------------------------------------------------------------

  it("excludes self (same user_name) via neq filter", async () => {
    const table = fakeTable([]);
    mockFrom.mockReturnValue(table);

    await GET(
      makeRequest({ query: "food ingredients", user: "Adi" })
    );

    expect(table.neq).toHaveBeenCalledWith("user_name", "Adi");
  });

  // -----------------------------------------------------------------------
  // Only considers last 7 days — verified via gte filter
  // -----------------------------------------------------------------------

  it("only considers last 7 days via gte filter", async () => {
    const table = fakeTable([]);
    mockFrom.mockReturnValue(table);

    const before = Date.now();
    await GET(
      makeRequest({ query: "food ingredients", user: "Adi" })
    );

    expect(table.gte).toHaveBeenCalledWith(
      "created_at",
      expect.any(String)
    );

    const gteArg = (table.gte as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const gteDate = new Date(gteArg).getTime();
    const sevenDaysBefore = before - 7 * 86400000;
    // Should be approximately 7 days ago
    expect(gteDate).toBeGreaterThanOrEqual(sevenDaysBefore - 1000);
    expect(gteDate).toBeLessThanOrEqual(Date.now() - 7 * 86400000 + 1000);
  });

  // -----------------------------------------------------------------------
  // Stop word-heavy query with no real tokens → no match
  // -----------------------------------------------------------------------

  it("stop word-heavy query with no real tokens returns no match", async () => {
    const data = [
      {
        user_name: "Satish",
        label: "food ingredients manufacturing",
        result_count: 10,
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    // Query consists entirely of stop words and single chars
    // tokenize filters: length > 1 AND not in STOP_WORDS
    // "in the and or for" are all stop words
    // "a" has length 1
    const res = await GET(
      makeRequest({ query: "in the and or for a", user: "Adi" })
    );
    const body = await res.json();

    // Empty token set → jaccard = 0 (union.size = 0 for query side,
    // but the other side has tokens, so union > 0, intersection = 0 → 0)
    // Since 0 is not > 0.35, no match
    expect(body.match).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Partial overlap query → tests threshold boundary
  // -----------------------------------------------------------------------

  it("partial overlap near threshold boundary — below 0.35 means no match", async () => {
    // Query: "food chemical suppliers" → tokens: {"food", "chemical", "suppliers"}
    // Candidate: "food ingredients manufacturing India wholesale" → tokens: {"food", "ingredients", "manufacturing", "india", "wholesale"}
    // Intersection: {"food"} = 1
    // Union: {"food", "chemical", "suppliers", "ingredients", "manufacturing", "india", "wholesale"} = 7
    // Jaccard = 1/7 ≈ 0.143 → below 0.35 → no match
    const data = [
      {
        user_name: "Satish",
        label: "food ingredients manufacturing India wholesale",
        result_count: 10,
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await GET(
      makeRequest({ query: "food chemical suppliers", user: "Adi" })
    );
    const body = await res.json();

    expect(body.match).toBeNull();
  });

  it("partial overlap above threshold returns a match", async () => {
    // Query: "food ingredients Asia" → tokens: {"food", "ingredients", "asia"}
    // Candidate: "food ingredients India" → tokens: {"food", "ingredients", "india"}
    // Intersection: {"food", "ingredients"} = 2
    // Union: {"food", "ingredients", "asia", "india"} = 4
    // Jaccard = 2/4 = 0.5 → above 0.35 → match!
    const data = [
      {
        user_name: "Satish",
        label: "food ingredients India",
        result_count: 10,
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await GET(
      makeRequest({ query: "food ingredients Asia", user: "Adi" })
    );
    const body = await res.json();

    expect(body.match).not.toBeNull();
    expect(body.match.user).toBe("Satish");
  });

  // -----------------------------------------------------------------------
  // Null result_count defaults to 0
  // -----------------------------------------------------------------------

  it("defaults result_count to 0 when null", async () => {
    const data = [
      {
        user_name: "Satish",
        label: "food ingredients manufacturing",
        result_count: null,
        created_at: "2026-02-09T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValue(fakeTable(data));

    const res = await GET(
      makeRequest({ query: "food ingredients manufacturing", user: "Adi" })
    );
    const body = await res.json();

    expect(body.match).not.toBeNull();
    expect(body.match.resultCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Queries the correct table with correct parameters
  // -----------------------------------------------------------------------

  it("queries search_history with correct select, neq, gte, not, order, limit", async () => {
    const table = fakeTable([]);
    mockFrom.mockReturnValue(table);

    await GET(
      makeRequest({ query: "food ingredients", user: "Adi" })
    );

    expect(mockFrom).toHaveBeenCalledWith("search_history");
    expect(table.select).toHaveBeenCalledWith(
      "user_name, label, result_count, created_at"
    );
    expect(table.neq).toHaveBeenCalledWith("user_name", "Adi");
    expect(table.not).toHaveBeenCalledWith("label", "is", null);
    expect(table.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(table.limit).toHaveBeenCalledWith(20);
  });
});
