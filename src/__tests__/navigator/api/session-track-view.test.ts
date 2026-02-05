import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { POST } from "@/app/api/session/track-view/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/session/track-view", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as unknown as import("next/server").NextRequest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/session/track-view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when domain is missing", async () => {
    const res = await POST(makeRequest({ userName: "Adi" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain and userName required");
  });

  it("returns 400 when userName is missing", async () => {
    const res = await POST(makeRequest({ domain: "acme.com" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain and userName required");
  });

  it("upserts company view and returns { ok: true } on success", async () => {
    const table = fakeTable();
    mockFrom.mockReturnValue(table);

    const res = await POST(
      makeRequest({ domain: "acme.com", name: "Acme Corp", userName: "Adi" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(mockFrom).toHaveBeenCalledWith("companies");
    expect(table.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "acme.com",
        name: "Acme Corp",
        first_viewed_by: "Adi",
        last_viewed_by: "Adi",
        viewed_by: "Adi",
        source: "exa",
      }),
      { onConflict: "domain", ignoreDuplicates: false }
    );
  });

  it("falls back to update when upsert returns an error", async () => {
    // First table (upsert) returns error, second table (update) succeeds
    const upsertTable = fakeTable(null, { message: "conflict" });
    const updateTable = fakeTable();
    mockFrom
      .mockReturnValueOnce(upsertTable)
      .mockReturnValueOnce(updateTable);

    const res = await POST(
      makeRequest({ domain: "acme.com", name: "Acme Corp", userName: "Satish" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Should have called from("companies") twice: once for upsert, once for update
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(updateTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_viewed_by: "Satish",
        viewed_by: "Satish",
      })
    );
    expect(updateTable.eq).toHaveBeenCalledWith("domain", "acme.com");
  });

  it("uses domain as name when name is not provided", async () => {
    const table = fakeTable();
    mockFrom.mockReturnValue(table);

    const res = await POST(makeRequest({ domain: "beta.io", userName: "Adi" }));

    expect(res.status).toBe(200);
    expect(table.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "beta.io" }),
      expect.anything()
    );
  });

  it("returns 500 when an unexpected error occurs", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("DB unreachable");
    });

    const res = await POST(
      makeRequest({ domain: "acme.com", userName: "Adi" })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal error");
  });
});
