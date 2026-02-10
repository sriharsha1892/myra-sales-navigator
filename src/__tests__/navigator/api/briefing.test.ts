/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client (chainable, like session-track-view pattern)
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Mocks — @/lib/cache (getCached + CacheKeys)
// ---------------------------------------------------------------------------

const mockGetCached = vi.fn();
vi.mock("@/lib/cache", () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  CacheKeys: {
    enrichedContacts: (domain: string) => `enriched:contacts:${domain}`,
    company: (domain: string) => `company:${domain}`,
    freshsales: (domain: string) => `freshsales:intel:${domain}`,
  },
}));

// ---------------------------------------------------------------------------
// Mocks — global fetch (for Gemini API)
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/outreach/enrollments/[id]/briefing/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chainable Supabase query result for .from("table").select().eq().single() */
function fakeTableSingle(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue({ data, error });
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  return chain;
}

/** Build a chainable Supabase query result for list queries (.from().select().eq().order().limit()) */
function fakeTableList(data: unknown[] = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  // Promise.allSettled needs a thenable — return a Promise that resolves
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

function makeRequest() {
  return new Request("http://localhost/api/outreach/enrollments/enr-1/briefing", {
    method: "GET",
  });
}

/** Creates the Next.js 15 params Promise */
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Fixture: a minimal enrollment row
const ENROLLMENT = {
  id: "enr-1",
  sequence_id: "seq-1",
  contact_id: "ct-101",
  company_domain: "acme.com",
  enrolled_by: "Adi",
  current_step: 0,
  status: "active",
  next_step_due_at: null,
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
};

// Fixture: cached contacts
const CACHED_CONTACTS = {
  contacts: [
    {
      id: "ct-101",
      firstName: "Jane",
      lastName: "Doe",
      title: "VP of Sales",
      seniority: "vp",
      phone: "+1-555-1234",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      email: "jane@acme.com",
      emailConfidence: 85,
      companyDomain: "acme.com",
      companyName: "Acme Corp",
      sources: ["apollo"],
      confidenceLevel: "medium" as const,
      lastVerified: null,
    },
    {
      id: "ct-102",
      firstName: "Mike",
      lastName: "Smith",
      title: "Director of Engineering",
      seniority: "director",
      phone: null,
      linkedinUrl: null,
      email: "mike@acme.com",
      emailConfidence: 70,
      companyDomain: "acme.com",
      companyName: "Acme Corp",
      sources: ["freshsales"],
      confidenceLevel: "medium" as const,
      lastVerified: null,
    },
  ],
};

// Fixture: cached company
const CACHED_COMPANY = {
  domain: "acme.com",
  name: "Acme Corp",
  industry: "Technology",
  employeeCount: 500,
  location: "San Francisco, CA",
  icpScore: 78,
  nlIcpReasoning: "Strong fit: tech company in target size range",
  signals: [
    {
      id: "sig-1",
      companyDomain: "acme.com",
      type: "funding",
      title: "Acme raises $50M Series C",
      description: "Acme Corp announced a Series C funding round.",
      date: "2026-01-15T00:00:00Z",
      sourceUrl: "https://news.example.com/acme",
      source: "exa",
    },
  ],
};

// Fixture: cached freshsales intel
const CACHED_FRESHSALES = {
  domain: "acme.com",
  status: "negotiation",
  account: { id: 1, name: "Acme Corp", website: "https://acme.com", industry: "Technology", employees: 500, owner: null },
  contacts: [],
  deals: [
    {
      id: 501,
      name: "Acme Enterprise Deal",
      amount: 75000,
      stage: "Proposal",
      probability: 60,
      expectedClose: "2026-03-01",
      createdAt: "2025-11-01T00:00:00Z",
      updatedAt: "2026-01-15T00:00:00Z",
      daysInStage: 25,
    },
  ],
  recentActivity: [
    {
      type: "email",
      title: "Follow-up email",
      date: "2026-01-28T00:00:00Z",
      actor: "Satish",
      outcome: "interested",
      contactName: "Jane Doe",
    },
  ],
  lastContactDate: "2026-01-28T00:00:00Z",
};

// Step logs from Supabase
const STEP_LOGS = [
  { channel: "email", completed_at: "2026-02-03T00:00:00Z", outcome: "opened", status: "completed" },
  { channel: "call", completed_at: "2026-02-05T00:00:00Z", outcome: "voicemail", status: "completed" },
];

/**
 * Set up the standard happy-path mocks:
 * - mockFrom for enrollment lookup (single)
 * - mockFrom for step_logs query (list)
 * - mockGetCached for contacts, company, freshsales caches
 * - fetchMock for Gemini API
 */
function stubHappyPath(overrides?: {
  enrollment?: unknown;
  enrollmentError?: unknown;
  contacts?: unknown;
  company?: unknown;
  freshsales?: unknown;
  stepLogs?: unknown[];
  geminiResponse?: string;
  geminiKey?: string;
}) {
  const {
    enrollment = ENROLLMENT,
    enrollmentError = null,
    contacts = CACHED_CONTACTS,
    company = CACHED_COMPANY,
    freshsales = CACHED_FRESHSALES,
    stepLogs = STEP_LOGS,
    geminiResponse = "Great to connect about your expansion plans, Jane.",
    geminiKey = "test-gemini-key",
  } = overrides ?? {};

  // Supabase: first .from("outreach_enrollments") for enrollment lookup
  const enrollmentTable = fakeTableSingle(enrollment, enrollmentError);
  // Supabase: second .from("outreach_step_logs") for step logs
  const stepLogsTable = fakeTableList(stepLogs);

  mockFrom.mockReturnValueOnce(enrollmentTable).mockReturnValueOnce(stepLogsTable);

  // getCached returns different data based on the cache key
  mockGetCached.mockImplementation((key: string) => {
    if (key.startsWith("enriched:contacts:")) return Promise.resolve(contacts);
    if (key.startsWith("company:")) return Promise.resolve(company);
    if (key.startsWith("freshsales:intel:")) return Promise.resolve(freshsales);
    return Promise.resolve(null);
  });

  // Gemini env var
  if (geminiKey) {
    vi.stubEnv("GEMINI_API_KEY", geminiKey);
  } else {
    vi.stubEnv("GEMINI_API_KEY", "");
  }

  // Gemini API response
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: geminiResponse }] } }],
    }),
  });
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  mockGetCached.mockReset();
  mockFrom.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ===========================================================================
// GET /api/outreach/enrollments/[id]/briefing
// ===========================================================================

describe("GET /api/outreach/enrollments/[id]/briefing", () => {
  // -------------------------------------------------------------------------
  // Enrollment not found
  // -------------------------------------------------------------------------

  it("returns 404 when enrollment not found", async () => {
    const enrollmentTable = fakeTableSingle(null, { message: "not found" });
    mockFrom.mockReturnValue(enrollmentTable);

    const res = await GET(makeRequest(), makeParams("enr-missing"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Enrollment not found");
  });

  it("returns 404 when enrollment data is null (no error object)", async () => {
    const enrollmentTable = fakeTableSingle(null, null);
    mockFrom.mockReturnValue(enrollmentTable);

    const res = await GET(makeRequest(), makeParams("enr-gone"));
    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Happy path — full BriefingData shape
  // -------------------------------------------------------------------------

  it("returns full BriefingData shape on happy path", async () => {
    stubHappyPath();

    const res = await GET(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.contact).toBeDefined();
    expect(body.company).toBeDefined();
    expect(body.crm).toBeDefined();
    expect(body.topSignal).toBeDefined();
    expect(body.previousSteps).toBeDefined();
    expect(body.suggestedOpener).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Contact resolution
  // -------------------------------------------------------------------------

  it("resolves contact from enrichedContacts cache by contact_id", async () => {
    stubHappyPath();

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.contact.name).toBe("Jane Doe");
    expect(body.contact.title).toBe("VP of Sales");
    expect(body.contact.seniority).toBe("vp");
    expect(body.contact.phone).toBe("+1-555-1234");
    expect(body.contact.linkedinUrl).toBe("https://linkedin.com/in/janedoe");
    expect(body.contact.emailConfidence).toBe(85);
  });

  it("uses default contact when enrichedContacts cache miss", async () => {
    stubHappyPath({ contacts: null });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.contact.name).toBe("");
    expect(body.contact.title).toBe("");
    expect(body.contact.seniority).toBe("");
    expect(body.contact.phone).toBeNull();
    expect(body.contact.emailConfidence).toBe(0);
  });

  it("uses default contact when contact_id not found in cache", async () => {
    stubHappyPath({
      contacts: {
        contacts: [
          { id: "ct-999", firstName: "Other", lastName: "Person", title: "CEO" },
        ],
      },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    // contact_id "ct-101" not in cache — fallback to defaults
    expect(body.contact.name).toBe("");
    expect(body.contact.title).toBe("");
  });

  // -------------------------------------------------------------------------
  // Company resolution
  // -------------------------------------------------------------------------

  it("resolves company from company cache", async () => {
    stubHappyPath();

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.company.name).toBe("Acme Corp");
    expect(body.company.domain).toBe("acme.com");
    expect(body.company.industry).toBe("Technology");
    expect(body.company.employeeCount).toBe(500);
    expect(body.company.location).toBe("San Francisco, CA");
    expect(body.company.icpScore).toBe(78);
    expect(body.company.icpReasoning).toBe("Strong fit: tech company in target size range");
  });

  it("uses domain as company name when cache miss", async () => {
    stubHappyPath({ company: null });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.company.name).toBe("acme.com");
    expect(body.company.domain).toBe("acme.com");
    expect(body.company.industry).toBe("");
    expect(body.company.employeeCount).toBe(0);
  });

  it("uses domain as fallback when company name is empty", async () => {
    stubHappyPath({
      company: { ...CACHED_COMPANY, name: "" },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    // name falls back to enrollment.company_domain when empty
    expect(body.company.name).toBe("acme.com");
  });

  // -------------------------------------------------------------------------
  // CRM warmth logic
  // -------------------------------------------------------------------------

  it("CRM warmth = 'hot' when open deal exists (stage not won/lost)", async () => {
    stubHappyPath({
      freshsales: {
        ...CACHED_FRESHSALES,
        status: "negotiation",
        deals: [{ ...CACHED_FRESHSALES.deals[0], stage: "Proposal" }],
        lastContactDate: null, // no recent contact date
      },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.warmth).toBe("hot");
  });

  it("CRM warmth = 'hot' when lastContactDate < 14 days ago", async () => {
    const recentDate = new Date(Date.now() - 5 * 86400000).toISOString(); // 5 days ago
    stubHappyPath({
      freshsales: {
        ...CACHED_FRESHSALES,
        status: "none",
        deals: [], // no open deals
        lastContactDate: recentDate,
      },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.warmth).toBe("hot");
  });

  it("CRM warmth = 'warm' when freshsales status !== 'none'", async () => {
    stubHappyPath({
      freshsales: {
        ...CACHED_FRESHSALES,
        status: "new_lead",
        deals: [{ ...CACHED_FRESHSALES.deals[0], stage: "Won" }], // no open deal (won)
        lastContactDate: new Date(Date.now() - 90 * 86400000).toISOString(), // 90 days ago
      },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.warmth).toBe("warm");
  });

  it("CRM warmth = 'warm' when lastContactDate < 60 days", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    stubHappyPath({
      freshsales: {
        ...CACHED_FRESHSALES,
        status: "none",
        deals: [{ ...CACHED_FRESHSALES.deals[0], stage: "Lost" }], // no open deal
        lastContactDate: thirtyDaysAgo,
      },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.warmth).toBe("warm");
  });

  it("CRM warmth = 'cold' when no CRM data at all", async () => {
    stubHappyPath({ freshsales: null });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.warmth).toBe("cold");
    expect(body.crm.status).toBe("none");
  });

  it("CRM warmth = 'cold' when lastContactDate > 60 days and status = 'none'", async () => {
    const longAgo = new Date(Date.now() - 120 * 86400000).toISOString();
    stubHappyPath({
      freshsales: {
        ...CACHED_FRESHSALES,
        status: "none",
        deals: [], // no deals at all
        lastContactDate: longAgo,
        recentActivity: [],
      },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.warmth).toBe("cold");
  });

  // -------------------------------------------------------------------------
  // Top deal + last activity
  // -------------------------------------------------------------------------

  it("populates topDeal from first Freshsales deal", async () => {
    stubHappyPath();

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.topDeal).not.toBeNull();
    expect(body.crm.topDeal.name).toBe("Acme Enterprise Deal");
    expect(body.crm.topDeal.stage).toBe("Proposal");
    expect(body.crm.topDeal.amount).toBe(75000);
    expect(body.crm.topDeal.daysInStage).toBe(25);
  });

  it("topDeal is null when no deals exist", async () => {
    stubHappyPath({
      freshsales: { ...CACHED_FRESHSALES, deals: [] },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.topDeal).toBeNull();
  });

  it("populates lastActivity from first Freshsales activity", async () => {
    stubHappyPath();

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.crm.lastActivity).not.toBeNull();
    expect(body.crm.lastActivity.type).toBe("email");
    expect(body.crm.lastActivity.date).toBe("2026-01-28T00:00:00Z");
    expect(body.crm.lastActivity.actor).toBe("Satish");
  });

  // -------------------------------------------------------------------------
  // Top signal
  // -------------------------------------------------------------------------

  it("populates topSignal from company signals[0]", async () => {
    stubHappyPath();

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.topSignal).not.toBeNull();
    expect(body.topSignal.type).toBe("funding");
    expect(body.topSignal.title).toBe("Acme raises $50M Series C");
    expect(body.topSignal.date).toBe("2026-01-15T00:00:00Z");
  });

  it("topSignal is null when company has no signals", async () => {
    stubHappyPath({
      company: { ...CACHED_COMPANY, signals: [] },
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.topSignal).toBeNull();
  });

  it("topSignal is null when company cache miss", async () => {
    stubHappyPath({ company: null });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.topSignal).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Previous steps
  // -------------------------------------------------------------------------

  it("maps previous steps from step_logs", async () => {
    stubHappyPath();

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.previousSteps).toHaveLength(2);
    expect(body.previousSteps[0].channel).toBe("email");
    expect(body.previousSteps[0].completedAt).toBe("2026-02-03T00:00:00Z");
    expect(body.previousSteps[0].outcome).toBe("opened");
    expect(body.previousSteps[1].channel).toBe("call");
    expect(body.previousSteps[1].outcome).toBe("voicemail");
  });

  it("previousSteps empty when no completed steps", async () => {
    stubHappyPath({ stepLogs: [] });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.previousSteps).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Suggested opener — Gemini
  // -------------------------------------------------------------------------

  it("returns suggested opener from Gemini when API key set", async () => {
    stubHappyPath({ geminiResponse: "Saw your Series C news, Jane -- congrats!" });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.suggestedOpener).toBe("Saw your Series C news, Jane -- congrats!");
    // Verify fetch was called with Gemini URL
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns fallback opener when Gemini call fails (network error)", async () => {
    stubHappyPath();
    // Override fetch to reject
    fetchMock.mockRejectedValue(new Error("Network error"));

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    // Fallback: "Hi Jane, I wanted to reach out about working together."
    expect(body.suggestedOpener).toContain("I wanted to reach out");
    expect(body.suggestedOpener).toContain("Jane");
  });

  it("returns fallback opener when Gemini response is not ok", async () => {
    stubHappyPath();
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.suggestedOpener).toContain("I wanted to reach out");
  });

  it("returns fallback opener when no GEMINI_API_KEY env var", async () => {
    stubHappyPath({ geminiKey: "" });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.suggestedOpener).toContain("I wanted to reach out");
    // Fetch should NOT be called for Gemini when no key
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fallback opener uses 'there' when contact name is empty", async () => {
    stubHappyPath({ contacts: null, geminiKey: "" });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.suggestedOpener).toContain("Hi there");
  });

  // -------------------------------------------------------------------------
  // Partial Promise.allSettled failures
  // -------------------------------------------------------------------------

  it("handles partial cache failures gracefully — contacts rejected", async () => {
    stubHappyPath();
    // Override getCached to reject for contacts only
    mockGetCached.mockImplementation((key: string) => {
      if (key.startsWith("enriched:contacts:")) return Promise.reject(new Error("Redis down"));
      if (key.startsWith("company:")) return Promise.resolve(CACHED_COMPANY);
      if (key.startsWith("freshsales:intel:")) return Promise.resolve(CACHED_FRESHSALES);
      return Promise.resolve(null);
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Contact falls back to defaults
    expect(body.contact.name).toBe("");
    // Company + CRM still populated
    expect(body.company.name).toBe("Acme Corp");
    expect(body.crm.warmth).toBe("hot");
  });

  it("handles partial cache failures gracefully — company rejected", async () => {
    stubHappyPath();
    mockGetCached.mockImplementation((key: string) => {
      if (key.startsWith("enriched:contacts:")) return Promise.resolve(CACHED_CONTACTS);
      if (key.startsWith("company:")) return Promise.reject(new Error("Redis down"));
      if (key.startsWith("freshsales:intel:")) return Promise.resolve(CACHED_FRESHSALES);
      return Promise.resolve(null);
    });

    const res = await GET(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Contact still populated
    expect(body.contact.name).toBe("Jane Doe");
    // Company falls back to domain-based defaults
    expect(body.company.name).toBe("acme.com");
    // No signal from company
    expect(body.topSignal).toBeNull();
  });

  it("handles all caches rejected — returns valid BriefingData with defaults", async () => {
    stubHappyPath({ geminiKey: "" });
    mockGetCached.mockRejectedValue(new Error("Redis down"));

    const res = await GET(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.contact.name).toBe("");
    expect(body.company.name).toBe("acme.com");
    expect(body.crm.warmth).toBe("cold");
    expect(body.topSignal).toBeNull();
    expect(body.suggestedOpener).toContain("I wanted to reach out");
  });
});
