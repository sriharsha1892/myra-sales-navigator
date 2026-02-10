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

import { GET, PUT } from "@/app/api/user/config/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDbConfig(overrides: Record<string, unknown> = {}) {
  return {
    user_name: "Adi",
    freshsales_domain: "myra",
    has_linkedin_sales_nav: true,
    preferences: { theme: "dark" },
    updated_at: "2026-02-09T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/user/config", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe("GET /api/user/config", () => {
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

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns user config with camelCase mapping", async () => {
    mockFrom.mockReturnValue(fakeTable(makeDbConfig()));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userName).toBe("Adi");
    expect(body.freshsalesDomain).toBe("myra");
    expect(body.hasLinkedinSalesNav).toBe(true);
    expect(body.preferences).toEqual({ theme: "dark" });
  });

  it("returns defaults when no config row exists (error)", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { code: "PGRST116", message: "No rows found" })
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userName).toBe("Adi");
    expect(body.freshsalesDomain).toBeNull();
    expect(body.hasLinkedinSalesNav).toBe(false);
    expect(body.preferences).toEqual({});
  });

  it("returns defaults when no config row exists (null data)", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userName).toBe("Adi");
    expect(body.freshsalesDomain).toBeNull();
    expect(body.hasLinkedinSalesNav).toBe(false);
    expect(body.preferences).toEqual({});
  });

  it("returns defaults when Supabase throws", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userName).toBe("Adi");
    expect(body.freshsalesDomain).toBeNull();
    expect(body.hasLinkedinSalesNav).toBe(false);
  });

  it("handles null optional fields in DB row", async () => {
    mockFrom.mockReturnValue(
      fakeTable(
        makeDbConfig({
          freshsales_domain: null,
          has_linkedin_sales_nav: null,
          preferences: null,
        })
      )
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.freshsalesDomain).toBeNull();
    expect(body.hasLinkedinSalesNav).toBe(false);
    expect(body.preferences).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Tests — PUT
// ---------------------------------------------------------------------------

describe("PUT /api/user/config", () => {
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
      makePutRequest({ freshsalesDomain: "myra" })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("upserts config and returns updated data", async () => {
    mockFrom.mockReturnValue(fakeTable(makeDbConfig()));

    const res = await PUT(
      makePutRequest({
        freshsalesDomain: "myra",
        hasLinkedinSalesNav: true,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userName).toBe("Adi");
    expect(body.freshsalesDomain).toBe("myra");
    expect(body.hasLinkedinSalesNav).toBe(true);
  });

  it("calls upsert with correct snake_case fields", async () => {
    const chain = fakeTable(makeDbConfig());
    mockFrom.mockReturnValue(chain);

    await PUT(
      makePutRequest({
        freshsalesDomain: "myra",
        hasLinkedinSalesNav: true,
        preferences: { theme: "dark" },
      })
    );

    expect(mockFrom).toHaveBeenCalledWith("user_config");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_name: "Adi",
        freshsales_domain: "myra",
        has_linkedin_sales_nav: true,
        preferences: { theme: "dark" },
      }),
      { onConflict: "user_name" }
    );
  });

  it("defaults null/false for missing optional fields", async () => {
    const chain = fakeTable(makeDbConfig({ freshsales_domain: null, has_linkedin_sales_nav: false }));
    mockFrom.mockReturnValue(chain);

    await PUT(makePutRequest({}));

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_name: "Adi",
        freshsales_domain: null,
        has_linkedin_sales_nav: false,
        preferences: {},
      }),
      { onConflict: "user_name" }
    );
  });

  it("returns 500 when Supabase upsert fails", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "upsert failed" })
    );

    const res = await PUT(
      makePutRequest({ freshsalesDomain: "myra" })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to save config");
  });

  it("returns 500 on unexpected error", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const res = await PUT(
      makePutRequest({ freshsalesDomain: "myra" })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to save config");
  });
});
