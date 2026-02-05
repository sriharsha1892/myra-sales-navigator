/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks (must be before imports) -----------------------------------------

const mockCookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

const mockVerifySessionToken = vi
  .fn()
  .mockResolvedValue({ name: "Adi", isAdmin: true });
const mockSignSessionToken = vi.fn().mockResolvedValue("fresh-mock-token");

vi.mock("@/lib/navigator/auth", () => ({
  verifySessionToken: (...args: unknown[]) =>
    mockVerifySessionToken(...args),
  signSessionToken: (...args: unknown[]) => mockSignSessionToken(...args),
}));

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// --- Supabase chain helper --------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "contains",
    "gt",
    "order",
    "limit",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// --- Helpers ----------------------------------------------------------------

async function callGET() {
  const { GET } = await import("@/app/api/auth/me/route");
  return GET();
}

// --- Tests ------------------------------------------------------------------

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCookieGet.mockReset();
    mockVerifySessionToken.mockReset();
    mockSignSessionToken.mockReset();
    mockFrom.mockReset();

    // Defaults
    mockVerifySessionToken.mockResolvedValue({ name: "Adi", isAdmin: true });
    mockSignSessionToken.mockResolvedValue("fresh-mock-token");

    // Default cookie: valid session
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "myra_session") {
        return { value: "valid-session-token" };
      }
      return undefined;
    });

    // Default Supabase tables
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "admin_config":
          return fakeTable({
            team_members: [
              {
                name: "Adi",
                isAdmin: true,
                lastLoginAt: "2026-01-28T10:00:00Z",
                lastMentionReadAt: null,
              },
              {
                name: "Satish",
                isAdmin: false,
                lastLoginAt: "2026-01-27T10:00:00Z",
                lastMentionReadAt: "2026-01-26T10:00:00Z",
              },
            ],
            auth_settings: { sessionDurationDays: 30 },
          });
        case "company_notes":
          return fakeTable([]);
        default:
          return fakeTable(null);
      }
    });
  });

  it("returns 401 'Not authenticated' when no session cookie exists", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await callGET();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 200 with user data for a valid session", async () => {
    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe("Adi");
    expect(body.isAdmin).toBe(true);
    expect(body.lastLoginAt).toBe("2026-01-28T10:00:00Z");
    expect(body.unreadMentions).toBeDefined();
    expect(Array.isArray(body.unreadMentions)).toBe(true);
  });

  it("returns 401 'Session expired' when token verification fails", async () => {
    mockVerifySessionToken.mockRejectedValue(new Error("Token expired"));

    const res = await callGET();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Session expired");

    // Should clear the cookie
    const setCookie = res.headers.getSetCookie?.();
    const sessionCookie = setCookie?.find((h: string) =>
      h.startsWith("myra_session=")
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("Max-Age=0");
  });

  it("returns 401 'User removed from team' when user not in team_members", async () => {
    // Token verifies as "Ghost" but that name isn't in team_members
    mockVerifySessionToken.mockResolvedValue({
      name: "Ghost",
      isAdmin: false,
    });

    const res = await callGET();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("User removed from team");
  });

  it("returns unread @mentions since lastMentionReadAt", async () => {
    // Satish has lastMentionReadAt set — notes after that date with mention should appear
    mockVerifySessionToken.mockResolvedValue({
      name: "Satish",
      isAdmin: false,
    });

    const mentionNote = {
      id: "note-99",
      companyDomain: "acme.com",
      content: "Hey @Satish check this out",
      authorName: "Adi",
      createdAt: "2026-01-27T10:00:00Z",
      mentions: ["Satish"],
    };

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "admin_config":
          return fakeTable({
            team_members: [
              {
                name: "Satish",
                isAdmin: false,
                lastLoginAt: "2026-01-25T10:00:00Z",
                lastMentionReadAt: "2026-01-26T10:00:00Z",
              },
            ],
            auth_settings: {},
          });
        case "company_notes":
          return fakeTable([mentionNote]);
        default:
          return fakeTable(null);
      }
    });

    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.unreadMentions).toHaveLength(1);
    expect(body.unreadMentions[0].noteId).toBe("note-99");
    expect(body.unreadMentions[0].companyDomain).toBe("acme.com");
    expect(body.unreadMentions[0].authorName).toBe("Adi");
  });

  it("returns empty unreadMentions when none exist", async () => {
    const res = await callGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.unreadMentions).toEqual([]);
  });

  it("refreshes session cookie by calling signSessionToken", async () => {
    const res = await callGET();
    expect(res.status).toBe(200);

    // signSessionToken should have been called with member data + session duration
    expect(mockSignSessionToken).toHaveBeenCalledWith("Adi", true, 30);

    // The refreshed cookie should be set
    const setCookie = res.headers.getSetCookie?.();
    const sessionCookie = setCookie?.find((h: string) =>
      h.startsWith("myra_session=")
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("fresh-mock-token");
  });

  it("uses configurable sessionDurationDays from auth_settings", async () => {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "admin_config":
          return fakeTable({
            team_members: [
              {
                name: "Adi",
                isAdmin: true,
                lastLoginAt: "2026-01-28T10:00:00Z",
                lastMentionReadAt: null,
              },
            ],
            auth_settings: { sessionDurationDays: 7 },
          });
        case "company_notes":
          return fakeTable([]);
        default:
          return fakeTable(null);
      }
    });

    await callGET();
    expect(mockSignSessionToken).toHaveBeenCalledWith("Adi", true, 7);
  });

  it("defaults sessionDurationDays to 30 when auth_settings is missing", async () => {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "admin_config":
          return fakeTable({
            team_members: [
              {
                name: "Adi",
                isAdmin: true,
                lastLoginAt: "2026-01-28T10:00:00Z",
                lastMentionReadAt: null,
              },
            ],
            auth_settings: null,
          });
        case "company_notes":
          return fakeTable([]);
        default:
          return fakeTable(null);
      }
    });

    await callGET();
    expect(mockSignSessionToken).toHaveBeenCalledWith("Adi", true, 30);
  });
});
