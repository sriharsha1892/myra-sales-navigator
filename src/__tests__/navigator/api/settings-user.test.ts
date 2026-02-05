/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks -------------------------------------------------------------------

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/navigator/auth", () => ({
  verifySessionToken: vi.fn(),
}));

import { GET, PUT } from "@/app/api/settings/user/route";

// Helper: build a chainable fake that resolves to { data, error }
function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// --- Fixtures ----------------------------------------------------------------

function makeDbSettings(overrides: Record<string, unknown> = {}) {
  return {
    user_name: "Adi",
    default_copy_format: "{{email}}",
    default_view: "contacts",
    default_sort: { field: "name", direction: "asc" },
    recent_domains: ["example.com", "acme.io"],
    updated_at: "2026-02-01T10:00:00Z",
    ...overrides,
  };
}

function makePutRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/settings/user", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// --- GET Tests ---------------------------------------------------------------

describe("GET /api/settings/user", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns stored settings when row exists (via ?user= param)", async () => {
    const dbRow = makeDbSettings();
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const req = new NextRequest(
      "http://localhost/api/settings/user?user=Adi"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settings).toEqual({
      userName: "Adi",
      defaultCopyFormat: "{{email}}",
      defaultView: "contacts",
      defaultSort: { field: "name", direction: "asc" },
      recentDomains: ["example.com", "acme.io"],
    });
  });

  it("returns default settings when no row exists (PGRST116)", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { code: "PGRST116", message: "No rows found" })
    );

    const req = new NextRequest(
      "http://localhost/api/settings/user?user=Kirandeep"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settings).toEqual({
      userName: "Kirandeep",
      defaultCopyFormat: "{{first_name}} {{last_name}} <{{email}}>",
      defaultView: "companies",
      defaultSort: { field: "icp_score", direction: "desc" },
      recentDomains: [],
    });
  });

  it("uses default copy format when stored value is null", async () => {
    const dbRow = makeDbSettings({ default_copy_format: null });
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const req = new NextRequest(
      "http://localhost/api/settings/user?user=Adi"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settings.defaultCopyFormat).toBe(
      "{{first_name}} {{last_name}} <{{email}}>"
    );
  });

  it("returns empty array for recentDomains when stored value is null", async () => {
    const dbRow = makeDbSettings({ recent_domains: null });
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const req = new NextRequest(
      "http://localhost/api/settings/user?user=Adi"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settings.recentDomains).toEqual([]);
  });

  it("returns 400 when user cannot be determined", async () => {
    const req = new NextRequest("http://localhost/api/settings/user");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Could not determine user");
  });

  it("returns 500 on Supabase error (non-PGRST116)", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { code: "42P01", message: "relation does not exist" })
    );

    const req = new NextRequest(
      "http://localhost/api/settings/user?user=Adi"
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch settings");
  });
});

// --- PUT Tests ---------------------------------------------------------------

describe("PUT /api/settings/user", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("upserts settings with valid body", async () => {
    const dbRow = makeDbSettings({
      default_copy_format: "{{email}}",
      default_view: "contacts",
    });
    mockFrom.mockReturnValue(fakeTable(dbRow));

    const res = await PUT(
      makePutRequest({
        userName: "Adi",
        defaultCopyFormat: "{{email}}",
        defaultView: "contacts",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settings.userName).toBe("Adi");
    expect(body.settings.defaultCopyFormat).toBe("{{email}}");
    expect(body.settings.defaultView).toBe("contacts");
  });

  it("returns 400 when userName is missing", async () => {
    const res = await PUT(
      makePutRequest({ defaultView: "contacts" }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("userName is required");
  });

  it("only includes provided fields in upsert row", async () => {
    const dbRow = makeDbSettings();
    const chain = fakeTable(dbRow);
    mockFrom.mockReturnValue(chain);

    await PUT(
      makePutRequest({
        userName: "Adi",
        defaultView: "contacts",
      }) as never
    );

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_name: "Adi",
        default_view: "contacts",
      }),
      { onConflict: "user_name" }
    );

    // Should NOT include fields that were not sent
    const upsertArg = (chain.upsert as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(upsertArg).not.toHaveProperty("default_copy_format");
    expect(upsertArg).not.toHaveProperty("default_sort");
    expect(upsertArg).not.toHaveProperty("recent_domains");
    expect(upsertArg).not.toHaveProperty("panel_widths");
    // Should always include updated_at
    expect(upsertArg).toHaveProperty("updated_at");
  });

  it("returns 500 on Supabase upsert error", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "upsert failed" })
    );

    const res = await PUT(
      makePutRequest({
        userName: "Adi",
        defaultView: "contacts",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to update settings");
  });
});
