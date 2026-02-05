/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Supabase mock -----------------------------------------------------------

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { GET, POST, DELETE } from "@/app/api/presets/route";

// Helper: build a chainable fake that resolves to { data, error }
function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// --- Fixtures ----------------------------------------------------------------

function makeDbPreset(overrides: Record<string, unknown> = {}) {
  return {
    id: "preset-1",
    name: "Enterprise APAC",
    filters: { vertical: "food-ingredients", region: "apac" },
    created_by: "Adi",
    created_at: "2026-01-30T12:00:00Z",
    updated_at: "2026-01-30T12:00:00Z",
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
  return new Request("http://localhost/api/presets", init);
}

// --- Tests -------------------------------------------------------------------

describe("GET /api/presets", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns presets with camelCase mapping", async () => {
    const dbRows = [
      makeDbPreset(),
      makeDbPreset({
        id: "preset-2",
        name: "SMB Europe",
        created_by: "Satish",
        created_at: "2026-01-29T08:00:00Z",
        updated_at: "2026-01-29T08:00:00Z",
      }),
    ];
    mockFrom.mockReturnValue(fakeTable(dbRows));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.presets).toHaveLength(2);
    expect(body.presets[0]).toEqual({
      id: "preset-1",
      name: "Enterprise APAC",
      filters: { vertical: "food-ingredients", region: "apac" },
      createdBy: "Adi",
      createdAt: "2026-01-30T12:00:00Z",
      updatedAt: "2026-01-30T12:00:00Z",
    });
    expect(body.presets[1].createdBy).toBe("Satish");
  });

  it("queries search_presets ordered by created_at DESC", async () => {
    const chain = fakeTable([]);
    mockFrom.mockReturnValue(chain);

    await GET();

    expect(mockFrom).toHaveBeenCalledWith("search_presets");
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
    expect(body.error).toBe("Failed to fetch presets");
  });
});

describe("POST /api/presets", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("creates a preset with valid body", async () => {
    const dbRow = makeDbPreset();
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const res = await POST(
      makeRequest("POST", {
        name: "Enterprise APAC",
        filters: { vertical: "food-ingredients", region: "apac" },
        createdBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.preset).toEqual({
      id: "preset-1",
      name: "Enterprise APAC",
      filters: { vertical: "food-ingredients", region: "apac" },
      createdBy: "Adi",
      createdAt: "2026-01-30T12:00:00Z",
      updatedAt: "2026-01-30T12:00:00Z",
    });
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makeRequest("POST", {
        filters: { vertical: "tech" },
        createdBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("name, filters, and createdBy are required");
  });

  it("returns 400 when filters is missing", async () => {
    const res = await POST(
      makeRequest("POST", {
        name: "Test Preset",
        createdBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("name, filters, and createdBy are required");
  });

  it("returns 400 when createdBy is missing", async () => {
    const res = await POST(
      makeRequest("POST", {
        name: "Test Preset",
        filters: { vertical: "tech" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("name, filters, and createdBy are required");
  });

  it("returns 500 on Supabase insert error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "insert failed" })
    );

    const res = await POST(
      makeRequest("POST", {
        name: "Test",
        filters: { vertical: "tech" },
        createdBy: "Adi",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to create preset");
  });
});

describe("DELETE /api/presets", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("deletes a preset by id and returns { deleted: true }", async () => {
    const chain = fakeTable(null);
    mockFrom.mockReturnValue(chain);

    const res = await DELETE(
      makeRequest("DELETE", { id: "preset-1" }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("search_presets");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "preset-1");
  });

  it("returns 400 when id is missing", async () => {
    const res = await DELETE(makeRequest("DELETE", {}) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("id is required");
  });
});
