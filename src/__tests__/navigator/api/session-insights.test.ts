import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — @supabase/supabase-js (this route uses createClient directly)
// ---------------------------------------------------------------------------

const { mockFrom } = vi.hoisted(() => {
  // Set env vars before module import so getSupabase() finds them
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/session/insights/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTable(data: unknown = null, error: unknown = null, count: number | null = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error, count });
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/session/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns insights with stale researching companies, follow-up count, and verticals", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const staleCompanies = [
      { domain: "old.com", name: "Old Corp", status_changed_at: tenDaysAgo },
    ];
    const searchData = [
      { filters: { verticals: ["food", "pharma"] } },
      { filters: { verticals: ["logistics"] } },
    ];
    const adminData = { verticals: ["food", "pharma", "logistics", "tech"] };

    // Four sb.from() calls:
    // 1. companies (stale researching)
    // 2. exported_contacts (follow-up count)
    // 3. search_history (recent verticals)
    // 4. admin_config (suggested vertical)
    const staleTable = fakeTable(staleCompanies);
    const exportTable = fakeTable(null, null, 5);
    const searchTable = fakeTable(searchData);
    const adminTable = fakeTable(adminData);

    mockFrom
      .mockReturnValueOnce(staleTable)
      .mockReturnValueOnce(exportTable)
      .mockReturnValueOnce(searchTable)
      .mockReturnValueOnce(adminTable);

    const req = new NextRequest("http://localhost/api/session/insights?user=Adi");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.staleResearching).toHaveLength(1);
    expect(body.staleResearching[0].domain).toBe("old.com");
    expect(body.staleResearching[0].daysSince).toBeGreaterThanOrEqual(10);

    expect(body.followUpCount).toBe(5);

    expect(body.recentVerticals).toEqual(
      expect.arrayContaining(["food", "pharma", "logistics"])
    );

    // "tech" is in admin verticals but not in recent searches
    expect(body.suggestedVertical).toBe("tech");
  });

  it("returns default empty result when Supabase returns null data", async () => {
    mockFrom.mockReturnValue(fakeTable(null));

    const req = new NextRequest("http://localhost/api/session/insights");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.staleResearching).toEqual([]);
    expect(body.followUpCount).toBe(0);
    expect(body.recentVerticals).toEqual([]);
    expect(body.suggestedVertical).toBeNull();
  });

  it("works without user param (does not filter exported_contacts by user)", async () => {
    mockFrom.mockReturnValue(fakeTable(null, null, 0));

    const req = new NextRequest("http://localhost/api/session/insights");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.followUpCount).toBe(0);
  });

  it("returns empty result on Supabase query error (graceful degradation)", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Database unreachable");
    });

    const req = new NextRequest("http://localhost/api/session/insights?user=Adi");
    const res = await GET(req);

    // The route catches errors and returns defaults
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.staleResearching).toEqual([]);
    expect(body.followUpCount).toBe(0);
  });

  it("returns null suggestedVertical when all admin verticals are already explored", async () => {
    const searchData = [
      { filters: { verticals: ["food", "pharma"] } },
    ];
    const adminData = { verticals: ["food", "pharma"] };

    const staleTable = fakeTable([]);
    const exportTable = fakeTable(null, null, 0);
    const searchTable = fakeTable(searchData);
    const adminTable = fakeTable(adminData);

    mockFrom
      .mockReturnValueOnce(staleTable)
      .mockReturnValueOnce(exportTable)
      .mockReturnValueOnce(searchTable)
      .mockReturnValueOnce(adminTable);

    const req = new NextRequest("http://localhost/api/session/insights?user=Adi");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestedVertical).toBeNull();
  });
});
