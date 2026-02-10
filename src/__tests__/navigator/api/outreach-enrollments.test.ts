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
// Mocks — cache + freshsales (fire-and-forget CRM sync in POST)
// ---------------------------------------------------------------------------

vi.mock("@/lib/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  CacheKeys: {
    freshsales: (domain: string) => `freshsales:intel:${domain}`,
    enrichedContacts: (domain: string) => `enriched:contacts:${domain}`,
  },
}));

vi.mock("@/lib/navigator/providers/freshsales", () => ({
  isFreshsalesAvailable: vi.fn().mockReturnValue(false),
  createFreshsalesTask: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/outreach/enrollments/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDbEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: "enr-1",
    sequence_id: "seq-1",
    contact_id: "contact-1",
    company_domain: "acme.com",
    enrolled_by: "Adi",
    current_step: 0,
    status: "active",
    next_step_due_at: "2026-02-10T10:00:00Z",
    created_at: "2026-02-09T10:00:00Z",
    updated_at: "2026-02-09T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/outreach/enrollments");
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }
  return new NextRequest(url);
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/outreach/enrollments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe("GET /api/outreach/enrollments", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns all enrollments with camelCase mapping", async () => {
    const dbRows = [makeDbEnrollment(), makeDbEnrollment({ id: "enr-2", contact_id: "contact-2" })];
    mockFrom.mockReturnValue(fakeTable(dbRows));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollments).toHaveLength(2);
    expect(body.enrollments[0].id).toBe("enr-1");
    expect(body.enrollments[0].sequenceId).toBe("seq-1");
    expect(body.enrollments[0].contactId).toBe("contact-1");
    expect(body.enrollments[0].companyDomain).toBe("acme.com");
    expect(body.enrollments[0].enrolledBy).toBe("Adi");
    expect(body.enrollments[0].currentStep).toBe(0);
    expect(body.enrollments[0].status).toBe("active");
  });

  it("returns empty array when no enrollments", async () => {
    mockFrom.mockReturnValue(fakeTable([]));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollments).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollments).toEqual([]);
  });

  it("filters by contactId query param", async () => {
    const chain = fakeTable([makeDbEnrollment()]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGetRequest({ contactId: "contact-1" }));

    expect(chain.eq).toHaveBeenCalledWith("contact_id", "contact-1");
  });

  it("filters by status query param", async () => {
    const chain = fakeTable([makeDbEnrollment()]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGetRequest({ status: "paused" }));

    expect(chain.eq).toHaveBeenCalledWith("status", "paused");
  });

  it("filters by dueBy query param and forces active status", async () => {
    const chain = fakeTable([makeDbEnrollment()]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGetRequest({ dueBy: "2026-02-10T23:59:59.999Z" }));

    expect(chain.lte).toHaveBeenCalledWith("next_step_due_at", "2026-02-10T23:59:59.999Z");
    expect(chain.eq).toHaveBeenCalledWith("status", "active");
  });

  it("returns 500 on Supabase error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "DB error" })
    );

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch enrollments");
  });
});

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe("POST /api/outreach/enrollments", () => {
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

    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        contactId: "c-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 400 when sequenceId is missing", async () => {
    const res = await POST(
      makePostRequest({
        contactId: "c-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required fields/);
  });

  it("returns 400 when contactId is missing", async () => {
    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required fields/);
  });

  it("returns 400 when companyDomain is missing", async () => {
    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        contactId: "c-1",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required fields/);
  });

  it("returns 404 when sequence does not exist", async () => {
    // First Supabase call: fetch sequence -> not found
    mockFrom.mockReturnValue(
      fakeTable(null, { code: "PGRST116" })
    );

    const res = await POST(
      makePostRequest({
        sequenceId: "nonexistent",
        contactId: "c-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Sequence not found");
  });

  it("returns 400 when sequence has no steps", async () => {
    // First call: fetch sequence with empty steps
    mockFrom.mockReturnValue(
      fakeTable({ steps: JSON.stringify([]) })
    );

    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        contactId: "c-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Sequence has no steps");
  });

  it("returns 409 when contact is already enrolled (active)", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Fetch sequence
        return fakeTable({
          steps: JSON.stringify([{ channel: "email", delayDays: 0 }]),
        });
      }
      // Check existing enrollment
      return fakeTable([{ id: "enr-existing", status: "active" }]);
    });

    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        contactId: "c-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already has an active enrollment/);
    expect(body.enrollmentId).toBe("enr-existing");
  });

  it("returns 409 when contact is already enrolled (paused)", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeTable({
          steps: JSON.stringify([{ channel: "email", delayDays: 0 }]),
        });
      }
      return fakeTable([{ id: "enr-paused", status: "paused" }]);
    });

    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        contactId: "c-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already has an paused enrollment/);
  });

  it("creates enrollment with valid data and returns 201", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Fetch sequence
        return fakeTable({
          steps: JSON.stringify([
            { channel: "email", delayDays: 0 },
            { channel: "call", delayDays: 2 },
          ]),
        });
      }
      if (callCount === 2) {
        // Check existing enrollment - none
        return fakeTable([]);
      }
      if (callCount === 3) {
        // Insert enrollment
        return fakeTable(makeDbEnrollment());
      }
      // Insert step log (fire-and-forget)
      return fakeTable(null);
    });

    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        contactId: "contact-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("enr-1");
    expect(body.sequenceId).toBe("seq-1");
    expect(body.contactId).toBe("contact-1");
    expect(body.companyDomain).toBe("acme.com");
    expect(body.enrolledBy).toBe("Adi");
    expect(body.currentStep).toBe(0);
    expect(body.status).toBe("active");
  });

  it("returns 500 when insert fails", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeTable({
          steps: JSON.stringify([{ channel: "email", delayDays: 0 }]),
        });
      }
      if (callCount === 2) {
        // No existing enrollment
        return fakeTable([]);
      }
      // Insert fails
      return fakeTable(null, { message: "insert failed" });
    });

    const res = await POST(
      makePostRequest({
        sequenceId: "seq-1",
        contactId: "c-1",
        companyDomain: "acme.com",
      })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create enrollment");
  });
});
