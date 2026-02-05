import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { PUT } from "@/app/api/company/[domain]/status/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

async function callPUT(domain: string, body: Record<string, unknown>) {
  const request = new NextRequest(
    "http://localhost/api/company/" + domain + "/status",
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
  return PUT(request, { params: Promise.resolve({ domain }) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/company/[domain]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with { ok: true } when status and userName are provided", async () => {
    const table = fakeTable();
    mockFrom.mockReturnValue(table);

    const res = await callPUT("acme.com", {
      status: "qualified",
      userName: "Adi",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    expect(mockFrom).toHaveBeenCalledWith("companies");
    expect(table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "qualified",
        status_changed_by: "Adi",
      })
    );
    expect(table.eq).toHaveBeenCalledWith("domain", "acme.com");
  });

  it("returns 400 when status is missing", async () => {
    const res = await callPUT("acme.com", { userName: "Adi" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/status and userName are required/i);
  });

  it("returns 400 when userName is missing", async () => {
    const res = await callPUT("acme.com", { status: "qualified" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/status and userName are required/i);
  });

  it("returns 500 when Supabase returns an error", async () => {
    const table = fakeTable(null, { message: "DB write failed" });
    mockFrom.mockReturnValue(table);

    const res = await callPUT("acme.com", {
      status: "qualified",
      userName: "Adi",
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("DB write failed");
  });
});
