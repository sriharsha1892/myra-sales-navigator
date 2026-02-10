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
// Mocks — cache + freshsales (fire-and-forget CRM sync)
// ---------------------------------------------------------------------------

vi.mock("@/lib/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  CacheKeys: {
    freshsales: (domain: string) => `freshsales:intel:${domain}`,
  },
}));

vi.mock("@/lib/navigator/providers/freshsales", () => ({
  isFreshsalesAvailable: vi.fn().mockReturnValue(false),
  createFreshsalesActivity: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { POST, GET } from "@/app/api/outreach/call-log/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/outreach/call-log", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/outreach/call-log");
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }
  return new NextRequest(url);
}

function makeDbCallLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    contact_id: "contact-1",
    company_domain: "acme.com",
    user_name: "Adi",
    outcome: "connected",
    notes: "Good call",
    duration_seconds: 120,
    created_at: "2026-02-09T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe("POST /api/outreach/call-log", () => {
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
        contactId: "c-1",
        companyDomain: "acme.com",
        outcome: "connected",
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 400 when contactId is missing", async () => {
    const res = await POST(
      makePostRequest({
        companyDomain: "acme.com",
        outcome: "connected",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required fields/);
  });

  it("returns 400 when companyDomain is missing", async () => {
    const res = await POST(
      makePostRequest({
        contactId: "c-1",
        outcome: "connected",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required fields/);
  });

  it("returns 400 when outcome is missing", async () => {
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

  it("returns 400 for invalid outcome value", async () => {
    const res = await POST(
      makePostRequest({
        contactId: "c-1",
        companyDomain: "acme.com",
        outcome: "hung_up",
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid outcome/);
  });

  it("returns 400 for negative durationSeconds", async () => {
    const res = await POST(
      makePostRequest({
        contactId: "c-1",
        companyDomain: "acme.com",
        outcome: "connected",
        durationSeconds: -5,
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/durationSeconds must be a non-negative number/);
  });

  it("creates call log with valid data and returns 201", async () => {
    const dbRow = makeDbCallLog();
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const res = await POST(
      makePostRequest({
        contactId: "contact-1",
        companyDomain: "acme.com",
        outcome: "connected",
        notes: "Good call",
        durationSeconds: 120,
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("log-1");
    expect(body.contactId).toBe("contact-1");
    expect(body.companyDomain).toBe("acme.com");
    expect(body.userName).toBe("Adi");
    expect(body.outcome).toBe("connected");
    expect(body.notes).toBe("Good call");
    expect(body.durationSeconds).toBe(120);
  });

  it("accepts all valid outcome values", async () => {
    const validOutcomes = ["connected", "voicemail", "no_answer", "busy", "wrong_number"];

    for (const outcome of validOutcomes) {
      mockFrom.mockReset();
      const dbRow = makeDbCallLog({ outcome });
      mockFrom.mockReturnValue(fakeTable(dbRow));

      const res = await POST(
        makePostRequest({
          contactId: "c-1",
          companyDomain: "acme.com",
          outcome,
        })
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.outcome).toBe(outcome);
    }
  });

  it("returns 500 when Supabase insert fails", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "insert failed" })
    );

    const res = await POST(
      makePostRequest({
        contactId: "c-1",
        companyDomain: "acme.com",
        outcome: "connected",
      })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create call log");
  });
});

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe("GET /api/outreach/call-log", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns 400 when contactId query parameter is missing", async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("contactId query parameter is required");
  });

  it("returns call logs for a contact", async () => {
    const rows = [
      makeDbCallLog(),
      makeDbCallLog({ id: "log-2", outcome: "voicemail", notes: null }),
    ];
    mockFrom.mockReturnValue(fakeTable(rows));

    const res = await GET(makeGetRequest({ contactId: "contact-1" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.callLogs).toHaveLength(2);
    expect(body.callLogs[0].id).toBe("log-1");
    expect(body.callLogs[0].outcome).toBe("connected");
    expect(body.callLogs[1].id).toBe("log-2");
    expect(body.callLogs[1].notes).toBeNull();
  });

  it("returns empty callLogs array when no data", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const res = await GET(makeGetRequest({ contactId: "contact-1" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.callLogs).toEqual([]);
  });

  it("returns 500 when Supabase query errors", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "DB error" })
    );

    const res = await GET(makeGetRequest({ contactId: "contact-1" }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch call logs");
  });
});
