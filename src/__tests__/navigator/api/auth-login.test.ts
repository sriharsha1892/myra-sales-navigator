/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks (must be before imports) -----------------------------------------

const mockSignSessionToken = vi.fn().mockResolvedValue("mock-token");

vi.mock("@/lib/navigator/auth", () => ({
  signSessionToken: (...args: unknown[]) => mockSignSessionToken(...args),
}));

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// --- Supabase chain helper --------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// --- Helpers ----------------------------------------------------------------

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function callPOST(body: unknown) {
  const { POST } = await import("@/app/api/auth/login/route");
  return POST(makeRequest(body));
}

// --- Tests ------------------------------------------------------------------

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSignSessionToken.mockClear();
    mockFrom.mockReset();

    vi.stubEnv("TEAM_PASSWORD", "correct-password");
    vi.stubEnv("ADMIN_USERS", "sriharsha,adi,jvs,reddy,sai");

    // Default Supabase setup: admin_config returns team_members with a few members
    mockFrom.mockImplementation(() =>
      fakeTable({
        team_members: [
          { name: "Adi", isAdmin: true, lastLoginAt: "2026-01-28T10:00:00Z" },
          { name: "Satish", isAdmin: false, lastLoginAt: "2026-01-27T10:00:00Z" },
          { name: "SriHarsha", isAdmin: true, lastLoginAt: null },
        ],
      })
    );
  });

  it("returns 200 with success, name, and isAdmin for a valid login", async () => {
    const res = await callPOST({ name: "Satish", password: "correct-password" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true, name: "Satish", isAdmin: false });
  });

  it("returns isAdmin: true for admin name 'Adi'", async () => {
    const res = await callPOST({ name: "Adi", password: "correct-password" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.isAdmin).toBe(true);
    expect(body.name).toBe("Adi");
  });

  it("returns isAdmin: false for non-admin name 'Satish'", async () => {
    const res = await callPOST({ name: "Satish", password: "correct-password" });
    const body = await res.json();
    expect(body.isAdmin).toBe(false);
  });

  it("returns 400 when name is missing", async () => {
    const res = await callPOST({ password: "correct-password" });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("Name and password are required");
  });

  it("returns 400 when password is missing", async () => {
    const res = await callPOST({ name: "Adi" });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("Name and password are required");
  });

  it("returns 401 with wrong password", async () => {
    const res = await callPOST({ name: "Adi", password: "wrong-password" });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Incorrect password");
  });

  it("returns 401 when TEAM_PASSWORD env is not set", async () => {
    vi.stubEnv("TEAM_PASSWORD", "");

    const res = await callPOST({ name: "Adi", password: "anything" });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Incorrect password");
  });

  it("calls signSessionToken with (name, isAdmin, 30)", async () => {
    await callPOST({ name: "JVS", password: "correct-password" });

    expect(mockSignSessionToken).toHaveBeenCalledWith("JVS", true, 30);
  });

  it("sets myra_session cookie on successful login", async () => {
    const res = await callPOST({ name: "Satish", password: "correct-password" });
    const setCookie = res.headers.getSetCookie?.();
    expect(setCookie).toBeDefined();

    const sessionCookie = setCookie?.find((h: string) =>
      h.startsWith("myra_session=")
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("mock-token");
    expect(sessionCookie).toContain("Path=/");
    expect(sessionCookie).toContain("HttpOnly");
  });

  it("does NOT block login when Supabase update fails", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Supabase is down");
    });

    const res = await callPOST({ name: "Adi", password: "correct-password" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.name).toBe("Adi");
  });
});
