/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST, DELETE } from "@/app/api/exclusions/route";

// --- Supabase mock -----------------------------------------------------------

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// Helper: build a chainable fake that resolves to { data, error, count }
function fakeTable(
  data: unknown,
  error: unknown = null,
  count: number | null = Array.isArray(data) ? data.length : null
) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  // When awaited directly (no .single()), resolve via .then
  (chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
    resolve({ data, error, count });
  return chain;
}

// --- Fixtures ----------------------------------------------------------------

function makeDbExclusion(overrides: Record<string, unknown> = {}) {
  return {
    id: "exc-1",
    type: "domain",
    value: "blocked.com",
    reason: "competitor",
    added_by: "Adi",
    created_at: "2026-01-28T10:00:00Z",
    source: "manual",
    ...overrides,
  };
}

function makeRequest(
  method: string,
  body?: Record<string, unknown>
): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request("http://localhost/api/exclusions", init);
}

// --- Tests -------------------------------------------------------------------

describe("GET /api/exclusions", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns exclusions mapped to camelCase", async () => {
    const dbRows = [
      makeDbExclusion(),
      makeDbExclusion({
        id: "exc-2",
        value: "spam.io",
        reason: null,
        source: null,
      }),
    ];
    mockFrom.mockReturnValue(fakeTable(dbRows));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exclusions).toHaveLength(2);
    expect(body.exclusions[0]).toEqual({
      id: "exc-1",
      type: "domain",
      value: "blocked.com",
      reason: "competitor",
      addedBy: "Adi",
      addedAt: "2026-01-28T10:00:00Z",
      source: "manual",
    });
    // null reason → undefined, null source → "manual"
    expect(body.exclusions[1].reason).toBeUndefined();
    expect(body.exclusions[1].source).toBe("manual");
  });

  it("returns empty array when no exclusions exist", async () => {
    mockFrom.mockReturnValue(fakeTable([]));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exclusions).toEqual([]);
  });

  it("queries exclusions table ordered by created_at DESC", async () => {
    const chain = fakeTable([]);
    mockFrom.mockReturnValue(chain);

    await GET();

    expect(mockFrom).toHaveBeenCalledWith("exclusions");
    expect(chain.select).toHaveBeenCalledWith("*");
    expect(chain.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("returns 500 on Supabase error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "DB connection failed" })
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch exclusions");
  });
});

describe("POST /api/exclusions (single)", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("inserts a single exclusion and returns camelCase shape", async () => {
    const dbRow = makeDbExclusion();
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const res = await POST(
      makeRequest("POST", {
        type: "domain",
        value: "blocked.com",
        reason: "competitor",
        addedBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exclusion).toEqual({
      id: "exc-1",
      type: "domain",
      value: "blocked.com",
      reason: "competitor",
      addedBy: "Adi",
      addedAt: "2026-01-28T10:00:00Z",
      source: "manual",
    });
  });

  it("inserts with reason=null when reason is not provided", async () => {
    const dbRow = makeDbExclusion({ reason: null });
    const chain = fakeTable(dbRow);
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeRequest("POST", {
        type: "domain",
        value: "nope.com",
        addedBy: "Satish",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exclusion.reason).toBeUndefined();
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reason: null, source: "manual" })
    );
  });

  it("returns 400 when type is missing", async () => {
    const res = await POST(
      makeRequest("POST", {
        value: "blocked.com",
        addedBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("type, value, and addedBy are required");
  });

  it("returns 400 when value and addedBy are missing", async () => {
    const res = await POST(
      makeRequest("POST", { type: "domain" }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("type, value, and addedBy are required");
  });
});

describe("POST /api/exclusions (bulk)", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("bulk inserts items and returns count", async () => {
    const chain = fakeTable(null, null, 3);
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeRequest("POST", {
        items: [
          { value: "a.com" },
          { value: "b.com", type: "company" },
          { value: "c.com", reason: "old lead" },
        ],
        addedBy: "Satish",
        source: "csv_upload",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.inserted).toBe(3);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: "domain",
          value: "a.com",
          reason: null,
          added_by: "Satish",
          source: "csv_upload",
        }),
        expect.objectContaining({
          type: "company",
          value: "b.com",
          reason: null,
        }),
        expect.objectContaining({
          value: "c.com",
          reason: "old lead",
        }),
      ]),
      { count: "exact" }
    );
  });

  it("defaults type to 'domain' and source to 'csv_upload'", async () => {
    const chain = fakeTable(null, null, 1);
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeRequest("POST", {
        items: [{ value: "test.com" }],
        addedBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.inserted).toBe(1);
    expect(chain.insert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: "domain",
          source: "csv_upload",
          added_by: "Adi",
        }),
      ],
      { count: "exact" }
    );
  });

  it("returns 500 on bulk insert error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "insert failed" }, null)
    );

    const res = await POST(
      makeRequest("POST", {
        items: [{ value: "fail.com" }],
        addedBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Bulk insert failed");
  });
});

describe("DELETE /api/exclusions", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("deletes an exclusion by id", async () => {
    const chain = fakeTable(null);
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(
      makeRequest("DELETE", { id: "exc-1" }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("exclusions");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "exc-1");
  });

  it("returns 400 when id is missing", async () => {
    const res = await DELETE(makeRequest("DELETE", {}) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("id is required");
  });

  it("returns 500 on Supabase delete error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "delete failed" })
    );

    const res = await DELETE(
      makeRequest("DELETE", { id: "exc-1" }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to delete exclusion");
  });
});
