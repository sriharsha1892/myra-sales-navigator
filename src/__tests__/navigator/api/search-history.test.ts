/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// --- Supabase mock -----------------------------------------------------------

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { GET, POST } from "@/app/api/search/history/route";

// Helper: build a chainable fake that resolves to { data, error }
function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// --- Fixtures ----------------------------------------------------------------

function makeDbHistoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "hist-1",
    user_name: "Satish",
    filters: { vertical: "food-ingredients", region: "apac" },
    result_count: 18,
    label: "APAC food search",
    created_at: "2026-02-01T14:00:00Z",
    ...overrides,
  };
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/search/history", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// --- GET Tests ---------------------------------------------------------------

describe("GET /api/search/history", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns history entries with camelCase mapping", async () => {
    const dbRows = [
      makeDbHistoryEntry(),
      makeDbHistoryEntry({
        id: "hist-2",
        user_name: "Adi",
        result_count: 25,
        label: null,
        created_at: "2026-02-01T10:00:00Z",
      }),
    ];
    mockFrom.mockReturnValue(fakeTable(dbRows));

    const req = new NextRequest("http://localhost/api/search/history");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.history).toHaveLength(2);
    expect(body.history[0]).toEqual({
      id: "hist-1",
      userId: "Satish",
      filters: { vertical: "food-ingredients", region: "apac" },
      resultCount: 18,
      label: "APAC food search",
      timestamp: "2026-02-01T14:00:00Z",
    });
    // null label → undefined
    expect(body.history[1].label).toBeUndefined();
    expect(body.history[1].userId).toBe("Adi");
  });

  it("filters by user when ?user= param is provided", async () => {
    const chain = fakeTable([makeDbHistoryEntry()]);
    mockFrom.mockReturnValue(chain);

    const req = new NextRequest(
      "http://localhost/api/search/history?user=Satish"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("user_name", "Satish");
    expect(body.history).toHaveLength(1);
  });

  it("does not filter by user when no ?user= param", async () => {
    const chain = fakeTable([]);
    mockFrom.mockReturnValue(chain);

    const req = new NextRequest("http://localhost/api/search/history");
    await GET(req);

    expect(chain.eq).not.toHaveBeenCalled();
  });

  it("queries search_history ordered by created_at DESC with limit 50", async () => {
    const chain = fakeTable([]);
    mockFrom.mockReturnValue(chain);

    const req = new NextRequest("http://localhost/api/search/history");
    await GET(req);

    expect(mockFrom).toHaveBeenCalledWith("search_history");
    expect(chain.select).toHaveBeenCalledWith("*");
    expect(chain.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("returns 500 on Supabase error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "DB connection failed" })
    );

    const req = new NextRequest("http://localhost/api/search/history");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch search history");
  });
});

// --- POST Tests --------------------------------------------------------------

describe("POST /api/search/history", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("creates a history entry with valid body", async () => {
    const dbRow = makeDbHistoryEntry();
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const res = await POST(
      makePostRequest({
        userName: "Satish",
        filters: { vertical: "food-ingredients", region: "apac" },
        resultCount: 18,
        label: "APAC food search",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entry).toEqual({
      id: "hist-1",
      userId: "Satish",
      filters: { vertical: "food-ingredients", region: "apac" },
      resultCount: 18,
      label: "APAC food search",
      timestamp: "2026-02-01T14:00:00Z",
    });
  });

  it("defaults resultCount to 0 and label to null when not provided", async () => {
    const dbRow = makeDbHistoryEntry({ result_count: 0, label: null });
    const chain = fakeTable(dbRow);
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makePostRequest({
        userName: "Adi",
        filters: { vertical: "tech" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_name: "Adi",
        filters: { vertical: "tech" },
        result_count: 0,
        label: null,
      })
    );
    expect(body.entry.resultCount).toBe(0);
    expect(body.entry.label).toBeUndefined();
  });

  it("returns 400 when userName is missing", async () => {
    const res = await POST(
      makePostRequest({
        filters: { vertical: "tech" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("userName and filters are required");
  });

  it("returns 400 when filters is missing", async () => {
    const res = await POST(
      makePostRequest({
        userName: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("userName and filters are required");
  });

  it("returns 500 on Supabase insert error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "insert failed" })
    );

    const res = await POST(
      makePostRequest({
        userName: "Satish",
        filters: { vertical: "food-ingredients" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to save search");
  });
});
