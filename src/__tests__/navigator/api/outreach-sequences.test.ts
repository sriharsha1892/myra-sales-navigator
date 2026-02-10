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

import { GET, POST } from "@/app/api/outreach/sequences/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
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
    description: "Standard cold outreach sequence",
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

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/outreach/sequences");
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }
  return new NextRequest(url);
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/outreach/sequences", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe("GET /api/outreach/sequences", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns all sequences with camelCase mapping", async () => {
    const dbRows = [
      makeDbSequence(),
      makeDbSequence({ id: "seq-2", name: "Follow-up", created_by: "Satish" }),
    ];
    mockFrom.mockReturnValue(fakeTable(dbRows));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sequences).toHaveLength(2);
    expect(body.sequences[0].id).toBe("seq-1");
    expect(body.sequences[0].name).toBe("Cold Outreach v1");
    expect(body.sequences[0].createdBy).toBe("Adi");
    expect(body.sequences[0].isTemplate).toBe(false);
    expect(body.sequences[0].steps).toHaveLength(2);
    expect(body.sequences[1].name).toBe("Follow-up");
  });

  it("returns empty array when no sequences exist", async () => {
    mockFrom.mockReturnValue(fakeTable([]));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sequences).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sequences).toEqual([]);
  });

  it("filters by createdBy query param", async () => {
    const chain = fakeTable([makeDbSequence()]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGetRequest({ createdBy: "Adi" }));

    expect(chain.eq).toHaveBeenCalledWith("created_by", "Adi");
  });

  it("filters by isTemplate=true query param", async () => {
    const chain = fakeTable([makeDbSequence({ is_template: true })]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGetRequest({ isTemplate: "true" }));

    expect(chain.eq).toHaveBeenCalledWith("is_template", true);
  });

  it("filters by isTemplate=false query param", async () => {
    const chain = fakeTable([makeDbSequence()]);
    mockFrom.mockReturnValue(chain);

    await GET(makeGetRequest({ isTemplate: "false" }));

    expect(chain.eq).toHaveBeenCalledWith("is_template", false);
  });

  it("returns 500 on Supabase error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "DB failure" })
    );

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch sequences");
  });

  it("parses steps stored as JSON string", async () => {
    const dbRows = [
      makeDbSequence({
        steps: JSON.stringify([{ channel: "email", delayDays: 0 }]),
      }),
    ];
    mockFrom.mockReturnValue(fakeTable(dbRows));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.sequences[0].steps).toHaveLength(1);
    expect(body.sequences[0].steps[0].channel).toBe("email");
  });

  it("handles steps already parsed as array", async () => {
    const dbRows = [
      makeDbSequence({
        steps: [{ channel: "call", delayDays: 1 }],
      }),
    ];
    mockFrom.mockReturnValue(fakeTable(dbRows));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.sequences[0].steps).toHaveLength(1);
    expect(body.sequences[0].steps[0].channel).toBe("call");
  });
});

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe("POST /api/outreach/sequences", () => {
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
        name: "Test",
        steps: [{ channel: "email", delayDays: 0 }],
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makePostRequest({
        steps: [{ channel: "email", delayDays: 0 }],
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required field: name");
  });

  it("returns 400 when steps is missing", async () => {
    const res = await POST(
      makePostRequest({ name: "Test Sequence" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("steps must be a non-empty array");
  });

  it("returns 400 when steps is empty array", async () => {
    const res = await POST(
      makePostRequest({ name: "Test Sequence", steps: [] })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("steps must be a non-empty array");
  });

  it("returns 400 when step has invalid channel", async () => {
    const res = await POST(
      makePostRequest({
        name: "Test Sequence",
        steps: [{ channel: "telegram", delayDays: 0 }],
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid channel "telegram"/);
  });

  it("returns 400 when delayDays is negative", async () => {
    const res = await POST(
      makePostRequest({
        name: "Test Sequence",
        steps: [{ channel: "email", delayDays: -1 }],
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/delayDays must be a non-negative number/);
  });

  it("creates sequence with valid data and returns 201", async () => {
    const dbRow = makeDbSequence();
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const res = await POST(
      makePostRequest({
        name: "Cold Outreach v1",
        description: "Standard cold outreach sequence",
        isTemplate: false,
        steps: [
          { channel: "email", delayDays: 0, subject: "Intro" },
          { channel: "call", delayDays: 2 },
        ],
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("seq-1");
    expect(body.name).toBe("Cold Outreach v1");
    expect(body.createdBy).toBe("Adi");
    expect(body.steps).toHaveLength(2);
  });

  it("accepts all valid channel types", async () => {
    const validChannels = ["email", "call", "linkedin_connect", "linkedin_inmail", "whatsapp"];

    for (const channel of validChannels) {
      mockFrom.mockReset();
      mockFrom.mockReturnValue(
        fakeTable(makeDbSequence({ steps: JSON.stringify([{ channel, delayDays: 0 }]) }))
      );

      const res = await POST(
        makePostRequest({
          name: `Test ${channel}`,
          steps: [{ channel, delayDays: 0 }],
        })
      );

      expect(res.status).toBe(201);
    }
  });

  it("returns 500 on Supabase insert error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "insert failed" })
    );

    const res = await POST(
      makePostRequest({
        name: "Test",
        steps: [{ channel: "email", delayDays: 0 }],
      })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create sequence");
  });
});
