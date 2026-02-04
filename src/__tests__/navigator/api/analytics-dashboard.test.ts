/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// --- Supabase mock -----------------------------------------------------------

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// Helper: build a chainable fake that resolves to { data, error }
function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  // When awaited directly (no .single()), resolve via .then
  (chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
    resolve({ data, error });
  return chain;
}

// --- Fixtures ----------------------------------------------------------------

const NOW = new Date("2026-02-01T12:00:00Z");

function makeExtraction(overrides: Record<string, unknown> = {}) {
  return {
    extracted_at: "2026-01-28T10:00:00Z",
    extracted_by: "Satish",
    company_domain: "acme.com",
    contacts: [{ email: "a@a.com" }],
    ...overrides,
  };
}

function makeSearch(overrides: Record<string, unknown> = {}) {
  return {
    created_at: "2026-01-28T10:00:00Z",
    user_name: "Satish",
    user_id: null,
    filters: { verticals: ["Food"], regions: ["APAC"] },
    ...overrides,
  };
}

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    first_viewed_at: "2026-01-28T10:00:00Z",
    last_viewed_at: "2026-01-29T10:00:00Z",
    last_viewed_by: "Adi",
    source: "exa",
    domain: "acme.com",
    icp_score: 75,
    ...overrides,
  };
}

function makeExclusion(overrides: Record<string, unknown> = {}) {
  return {
    type: "domain",
    value: "blocked.com",
    reason: "competitor",
    added_by: "Adi",
    source: "manual",
    created_at: "2026-01-27T10:00:00Z",
    ...overrides,
  };
}

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    author_name: "Sudeshana",
    created_at: "2026-01-28T10:00:00Z",
    ...overrides,
  };
}

// --- Helpers -----------------------------------------------------------------

function setupTables({
  extractions = [] as unknown[],
  searches = [] as unknown[],
  companies = [] as unknown[],
  exclusions = [] as unknown[],
  notes = [] as unknown[],
  adminRow = null as unknown,
  adminError = null as unknown,
} = {}) {
  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case "contact_extractions":
        return fakeTable(extractions);
      case "search_history":
        return fakeTable(searches);
      case "companies":
        return fakeTable(companies);
      case "exclusions":
        return fakeTable(exclusions);
      case "company_notes":
        return fakeTable(notes);
      case "admin_config":
        return fakeTable(adminRow, adminError);
      default:
        return fakeTable(null);
    }
  });
}

function makeRequest(params = "") {
  const url = `http://localhost:3000/api/analytics/dashboard${params ? "?" + params : ""}`;
  return new NextRequest(url);
}

async function callGET(params = "") {
  const { GET } = await import(
    "@/app/api/analytics/dashboard/route"
  );
  const res = await GET(makeRequest(params));
  return res.json();
}

// --- Tests -------------------------------------------------------------------

describe("GET /api/analytics/dashboard", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
    vi.resetModules();
    mockFrom.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ======================== Defaults (no query params) ========================

  describe("defaults (no query params)", () => {
    it("returns full dashboard shape", async () => {
      setupTables();
      const body = await callGET();

      expect(body).toHaveProperty("kpis");
      expect(body).toHaveProperty("kpiTargets");
      expect(body).toHaveProperty("funnel");
      expect(body).toHaveProperty("teamActivity");
      expect(body).toHaveProperty("sourcePerformance");
      expect(body).toHaveProperty("filterHeatmap");
      expect(body).toHaveProperty("exclusions");
    });

    it("defaults to 7d range (Jan 25 → Feb 1)", async () => {
      // Record on Jan 26 (inside 7d) vs Jan 20 (outside)
      setupTables({
        extractions: [
          makeExtraction({ extracted_at: "2026-01-26T10:00:00Z" }),
          makeExtraction({ extracted_at: "2026-01-20T10:00:00Z" }),
        ],
      });
      const body = await callGET();
      expect(body.kpis.exportsThisWeek).toBe(1);
    });

    it("returns default kpiTargets {20, 60} when analytics_settings missing", async () => {
      setupTables({ adminRow: null });
      const body = await callGET();
      expect(body.kpiTargets).toEqual({ exportsThisWeek: 20, avgIcpScore: 60 });
    });

    it("returns custom kpiTargets when analytics_settings present", async () => {
      setupTables({
        adminRow: {
          analytics_settings: { kpiTargets: { exportsThisWeek: 50, avgIcpScore: 80 } },
        },
      });
      const body = await callGET();
      expect(body.kpiTargets).toEqual({ exportsThisWeek: 50, avgIcpScore: 80 });
    });
  });

  // ======================== Date range filtering =============================

  describe("date range filtering", () => {
    it("only includes records in the specified window", async () => {
      setupTables({
        extractions: [
          makeExtraction({ extracted_at: "2026-01-22T10:00:00Z" }),
          makeExtraction({ extracted_at: "2026-01-18T10:00:00Z" }),
          makeExtraction({ extracted_at: "2026-01-26T10:00:00Z" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.kpis.exportsThisWeek).toBe(1);
    });

    it("filters prospects discovered by first_viewed_at", async () => {
      setupTables({
        companies: [
          makeCompany({ first_viewed_at: "2026-01-22T10:00:00Z" }),
          makeCompany({ first_viewed_at: "2026-01-18T10:00:00Z", domain: "other.com" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.kpis.prospectsDiscovered).toBe(1);
    });

    it("filters active users by range", async () => {
      setupTables({
        searches: [
          makeSearch({ created_at: "2026-01-22T10:00:00Z", user_name: "Adi" }),
          makeSearch({ created_at: "2026-01-18T10:00:00Z", user_name: "Satish" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.kpis.activeUsers).toBe(1);
    });

    it("filters funnel searches by range", async () => {
      setupTables({
        searches: [
          makeSearch({ created_at: "2026-01-22T10:00:00Z" }),
          makeSearch({ created_at: "2026-01-18T10:00:00Z" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.funnel.searches).toBe(1);
    });

    it("filters funnel companiesViewed by range", async () => {
      setupTables({
        companies: [
          makeCompany({ last_viewed_at: "2026-01-22T10:00:00Z" }),
          makeCompany({ last_viewed_at: "2026-01-18T10:00:00Z", domain: "other.com" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.funnel.companiesViewed).toBe(1);
    });

    it("filters funnel contactsExtracted by range", async () => {
      setupTables({
        extractions: [
          makeExtraction({
            extracted_at: "2026-01-22T10:00:00Z",
            contacts: [{ email: "a@a.com" }, { email: "b@b.com" }],
          }),
          makeExtraction({ extracted_at: "2026-01-18T10:00:00Z" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.funnel.contactsExtracted).toBe(2);
    });

    it("filters team activity counts but lastActive stays absolute", async () => {
      setupTables({
        searches: [
          makeSearch({ created_at: "2026-01-22T10:00:00Z", user_name: "Adi" }),
          makeSearch({ created_at: "2026-01-30T10:00:00Z", user_name: "Adi" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      const adi = body.teamActivity.find(
        (u: { name: string }) => u.name === "Adi"
      );
      expect(adi.searches).toBe(1); // only the Jan 22 one
      expect(adi.lastActive).toBe("2026-01-30T10:00:00Z"); // absolute
    });

    it("avgIcpScore NOT filtered by date (uses all companies)", async () => {
      setupTables({
        companies: [
          makeCompany({ icp_score: 80, first_viewed_at: "2026-01-22T10:00:00Z" }),
          makeCompany({
            icp_score: 40,
            first_viewed_at: "2026-01-10T10:00:00Z",
            domain: "other.com",
          }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      // Both scores averaged: (80 + 40) / 2 = 60
      expect(body.kpis.avgIcpScore).toBe(60);
    });

    it("source performance NOT filtered by date", async () => {
      setupTables({
        companies: [
          makeCompany({
            source: "apollo",
            icp_score: 70,
            first_viewed_at: "2026-01-10T10:00:00Z",
          }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.sourcePerformance.length).toBe(1);
      expect(body.sourcePerformance[0].source).toBe("apollo");
    });

    it("filter heatmap NOT filtered by date", async () => {
      setupTables({
        searches: [
          makeSearch({
            created_at: "2026-01-10T10:00:00Z",
            filters: { verticals: ["SaaS"], regions: ["EU"] },
          }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.filterHeatmap.verticals["SaaS"]).toBe(1);
      expect(body.filterHeatmap.regions["EU"]).toBe(1);
    });
  });

  // ======================== Boundary conditions ==============================

  describe("boundary conditions", () => {
    it("record exactly at from date is included", async () => {
      setupTables({
        extractions: [
          makeExtraction({ extracted_at: "2026-01-20T00:00:00.000Z" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.kpis.exportsThisWeek).toBe(1);
    });

    it("record exactly at to date end-of-day is included", async () => {
      setupTables({
        extractions: [
          makeExtraction({ extracted_at: "2026-01-25T23:59:59.999Z" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.kpis.exportsThisWeek).toBe(1);
    });

    it("record 1ms before from is excluded", async () => {
      setupTables({
        extractions: [
          makeExtraction({ extracted_at: "2026-01-19T23:59:59.999Z" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-25");
      expect(body.kpis.exportsThisWeek).toBe(0);
    });

    it("single-day range (from === to) works", async () => {
      setupTables({
        extractions: [
          makeExtraction({ extracted_at: "2026-01-20T12:00:00Z" }),
          makeExtraction({ extracted_at: "2026-01-21T00:00:01Z" }),
        ],
      });
      const body = await callGET("from=2026-01-20&to=2026-01-20");
      expect(body.kpis.exportsThisWeek).toBe(1);
    });
  });

  // ======================== Empty data =======================================

  describe("empty data", () => {
    it("all tables empty → zeros everywhere, empty arrays", async () => {
      setupTables();
      const body = await callGET();

      expect(body.kpis).toEqual({
        exportsThisWeek: 0,
        prospectsDiscovered: 0,
        activeUsers: 0,
        avgIcpScore: 0,
      });
      expect(body.funnel).toEqual({
        searches: 0,
        companiesViewed: 0,
        contactsExtracted: 0,
      });
      expect(body.teamActivity).toEqual([]);
      expect(body.sourcePerformance).toEqual([]);
      expect(body.filterHeatmap).toEqual({ verticals: {}, regions: {} });
      expect(body.exclusions.byType).toEqual({});
      expect(body.exclusions.topReasons).toEqual([]);
      expect(body.exclusions.bySource).toEqual({});
      expect(body.exclusions.recent).toEqual([]);
    });

    it("no admin_config row → default targets", async () => {
      setupTables({ adminRow: null });
      const body = await callGET();
      expect(body.kpiTargets).toEqual({ exportsThisWeek: 20, avgIcpScore: 60 });
    });
  });

  // ======================== Error handling ===================================

  describe("error handling", () => {
    it("supabase error → 500 response", async () => {
      mockFrom.mockImplementation(() => {
        throw new Error("DB connection failed");
      });
      const { GET } = await import(
        "@/app/api/analytics/dashboard/route"
      );
      const res = await GET(makeRequest());
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to load analytics");
    });
  });
});
