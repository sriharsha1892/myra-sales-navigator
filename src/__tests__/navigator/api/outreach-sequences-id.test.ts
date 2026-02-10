/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

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

import { GET, PUT, DELETE } from "@/app/api/outreach/sequences/[id]/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDbSequence(overrides: Record<string, unknown> = {}) {
  return {
    id: "seq-1",
    name: "Cold Outreach v1",
    description: "Standard cold outreach",
    created_by: "Adi",
    is_template: false,
    steps: JSON.stringify([
      { channel: "email", delayDays: 0, subject: "Intro" },
      { channel: "call", delayDays: 2 },
    ]),
    created_at: "2026-02-08T10:00:00Z",
    updated_at: "2026-02-08T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: Record<string, unknown>): NextRequest {
  const init: Record<string, unknown> = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest("http://localhost/api/outreach/sequences/seq-1", init);
}

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe("GET /api/outreach/sequences/[id]", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns sequence by id with camelCase mapping", async () => {
    const dbRow = makeDbSequence();
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const res = await GET(makeRequest("GET"), makeParams("seq-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("seq-1");
    expect(body.name).toBe("Cold Outreach v1");
    expect(body.createdBy).toBe("Adi");
    expect(body.isTemplate).toBe(false);
    expect(body.steps).toHaveLength(2);
  });

  it("returns 404 when sequence is not found", async () => {
    mockFrom.mockReturnValue(fakeTable(null, { code: "PGRST116" }));

    const res = await GET(makeRequest("GET"), makeParams("nonexistent"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Sequence not found");
  });

  it("returns 500 on unexpected error", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const res = await GET(makeRequest("GET"), makeParams("seq-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch sequence");
  });
});

// ---------------------------------------------------------------------------
// Tests — PUT
// ---------------------------------------------------------------------------

describe("PUT /api/outreach/sequences/[id]", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    mockFrom.mockReset();
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "user_name") return { value: "Adi" };
      return undefined;
    });
  });

  it("returns 401 when user_name cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await PUT(
      makeRequest("PUT", { name: "Updated" }),
      makeParams("seq-1")
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 404 when sequence does not exist", async () => {
    // First call: check existence returns null
    mockFrom.mockReturnValue(fakeTable(null, { code: "PGRST116" }));

    const res = await PUT(
      makeRequest("PUT", { name: "Updated" }),
      makeParams("nonexistent")
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Sequence not found");
  });

  it("updates sequence name and returns updated data", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Check existence
        return fakeTable({ id: "seq-1" });
      }
      // Update
      return fakeTable(makeDbSequence({ name: "Updated Name" }));
    });

    const res = await PUT(
      makeRequest("PUT", { name: "Updated Name" }),
      makeParams("seq-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Updated Name");
  });

  it("updates description and isTemplate", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable({ id: "seq-1" });
      return fakeTable(
        makeDbSequence({
          description: "New desc",
          is_template: true,
        })
      );
    });

    const res = await PUT(
      makeRequest("PUT", { description: "New desc", isTemplate: true }),
      makeParams("seq-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.description).toBe("New desc");
    expect(body.isTemplate).toBe(true);
  });

  it("updates steps", async () => {
    const newSteps = [{ channel: "email", delayDays: 0 }];
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable({ id: "seq-1" });
      return fakeTable(
        makeDbSequence({ steps: JSON.stringify(newSteps) })
      );
    });

    const res = await PUT(
      makeRequest("PUT", { steps: newSteps }),
      makeParams("seq-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0].channel).toBe("email");
  });

  it("returns 500 when update fails in Supabase", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable({ id: "seq-1" });
      return fakeTable(null, { message: "update failed" });
    });

    const res = await PUT(
      makeRequest("PUT", { name: "Updated" }),
      makeParams("seq-1")
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to update sequence");
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE
// ---------------------------------------------------------------------------

describe("DELETE /api/outreach/sequences/[id]", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    mockFrom.mockReset();
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "user_name") return { value: "Adi" };
      return undefined;
    });
  });

  it("returns 401 when user_name cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await DELETE(makeRequest("DELETE"), makeParams("seq-1"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 400 when sequence has active enrollments", async () => {
    // First call: check active enrollments
    mockFrom.mockReturnValue(
      fakeTable([{ id: "enr-1" }])
    );

    const res = await DELETE(makeRequest("DELETE"), makeParams("seq-1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Cannot delete sequence with active enrollments/);
  });

  it("deletes sequence when no active enrollments", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Check active enrollments - none
        return fakeTable([]);
      }
      // Delete
      return fakeTable(null);
    });

    const res = await DELETE(makeRequest("DELETE"), makeParams("seq-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 when enrollment check fails", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "DB error" })
    );

    const res = await DELETE(makeRequest("DELETE"), makeParams("seq-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to check enrollments");
  });

  it("returns 500 when delete operation fails", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // No active enrollments
        return fakeTable([]);
      }
      // Delete fails
      return fakeTable(null, { message: "delete failed" });
    });

    const res = await DELETE(makeRequest("DELETE"), makeParams("seq-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to delete sequence");
  });
});
