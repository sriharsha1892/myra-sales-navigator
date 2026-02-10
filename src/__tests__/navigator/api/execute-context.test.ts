/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock fns — vi.hoisted ensures these are available to vi.mock factories
// ---------------------------------------------------------------------------

const { mockCookieGet, mockFrom, mockGetCached } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockFrom: vi.fn(),
  mockGetCached: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — next/headers (cookies)
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

// ---------------------------------------------------------------------------
// Mocks — Supabase server client (chainable)
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Mocks — @/lib/cache (dynamic import in route)
// ---------------------------------------------------------------------------

vi.mock("@/lib/cache", () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  CacheKeys: {
    enrichedContacts: (domain: string) => `enriched:contacts:${domain}`,
    company: (domain: string) => `company:${domain}`,
    freshsales: (domain: string) => `freshsales:intel:${domain}`,
  },
}));

// ---------------------------------------------------------------------------
// Mocks — freshsales provider (fire-and-forget CRM sync)
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/providers/freshsales", () => ({
  isFreshsalesAvailable: vi.fn().mockReturnValue(false),
  createFreshsalesActivity: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — global fetch (for draft API calls)
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/outreach/enrollments/[id]/execute/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeTableSingle(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockReturnValue({ data, error });
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  return chain;
}

function fakeTableList(data: unknown[] = [], error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue({ data: null, error: null });
  chain.update = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/outreach/enrollments/enr-1/execute", {
    method: "POST",
    body: body ? JSON.stringify(body) : "{}",
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Fixtures

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

const SEQUENCE_STEPS = [
  { channel: "email", delayDays: 0, template: "intro", tone: "formal" },
  { channel: "call", delayDays: 2, notes: "Discuss pricing" },
  { channel: "linkedin_connect", delayDays: 3, tone: "casual" },
];

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
      confidenceLevel: "medium",
      lastVerified: null,
      freshsalesOwnerId: 42,
    },
  ],
};

const CACHED_COMPANY = {
  domain: "acme.com",
  name: "Acme Corp",
  industry: "Technology",
  employeeCount: 500,
  location: "San Francisco, CA",
  icpScore: 78,
  hubspotStatus: "lead",
  freshsalesStatus: "negotiation",
  signals: [
    {
      id: "sig-1",
      companyDomain: "acme.com",
      type: "funding",
      title: "Acme raises $50M Series C",
      description: "",
      date: "2026-01-15T00:00:00Z",
      sourceUrl: null,
      source: "exa",
    },
  ],
};

const UPDATED_ENROLLMENT = {
  id: "enr-1",
  sequence_id: "seq-1",
  contact_id: "ct-101",
  company_domain: "acme.com",
  enrolled_by: "Adi",
  current_step: 1,
  status: "active",
  next_step_due_at: "2026-02-12T00:00:00Z",
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-10T00:00:00Z",
};

const STEP_LOGS = [
  { id: "sl-1", enrollment_id: "enr-1", step_index: 0, channel: "email", status: "completed", completed_at: "2026-02-10T00:00:00Z", outcome: null, notes: null, draft_content: "Hello..." },
  { id: "sl-2", enrollment_id: "enr-1", step_index: 1, channel: "call", status: "pending", completed_at: null, outcome: null, notes: null, draft_content: null },
];

/**
 * Wire up the standard mock chain for execute:
 *   1. cookies() -> user_name
 *   2. from("outreach_enrollments").select().eq().single() -> enrollment
 *   3. from("outreach_sequences").select().eq().single() -> sequence
 *   4. getCached calls for contacts + company
 *   5. fetch for draft API
 *   6. from("outreach_step_logs").update()... -> mark completed
 *   7. from("outreach_step_logs").insert() -> create next step
 *   8. from("outreach_enrollments").update()... -> advance enrollment
 *   9. from("outreach_step_logs").select()... -> fetch all step logs
 */
function stubHappyPath(overrides?: {
  enrollment?: Record<string, unknown>;
  enrollmentError?: unknown;
  sequence?: unknown;
  sequenceError?: unknown;
  contacts?: unknown;
  company?: unknown;
  draftResponse?: Record<string, unknown>;
  isLastStep?: boolean;
  enrollmentStatus?: string;
}) {
  const {
    enrollment = ENROLLMENT,
    enrollmentError = null,
    sequence = { steps: SEQUENCE_STEPS },
    sequenceError = null,
    contacts = CACHED_CONTACTS,
    company = CACHED_COMPANY,
    draftResponse = { subject: "Intro: Acme Corp", message: "Hi Jane, I wanted to reach out..." },
    isLastStep = false,
    enrollmentStatus,
  } = overrides ?? {};

  const actualEnrollment = enrollmentStatus
    ? { ...enrollment, status: enrollmentStatus }
    : enrollment;

  // Cookie: user_name
  mockCookieGet.mockImplementation((name: string) => {
    if (name === "user_name") return { value: "Adi" };
    return undefined;
  });

  // Supabase calls — need to mock mockFrom for multiple .from() calls in sequence
  const enrollmentTable = fakeTableSingle(actualEnrollment, enrollmentError);
  const sequenceTable = fakeTableSingle(sequence, sequenceError);
  const updateStepLogTable = fakeTableSingle(); // mark step completed
  const insertStepLogTable = fakeTableList(); // insert next step
  const updateEnrollmentTable = fakeTableSingle(
    isLastStep
      ? { ...UPDATED_ENROLLMENT, status: "completed", current_step: SEQUENCE_STEPS.length }
      : UPDATED_ENROLLMENT
  );
  const fetchStepLogsTable = fakeTableList(STEP_LOGS);
  // user_config for call channel
  const userConfigTable = fakeTableSingle({ freshsales_domain: "myra" });

  mockFrom
    .mockReturnValueOnce(enrollmentTable)     // outreach_enrollments (lookup)
    .mockReturnValueOnce(sequenceTable)        // outreach_sequences (lookup)
    .mockReturnValueOnce(updateStepLogTable)   // outreach_step_logs (update completed)
    .mockReturnValueOnce(insertStepLogTable)   // outreach_step_logs (insert next)
    .mockReturnValueOnce(updateEnrollmentTable) // outreach_enrollments (advance)
    .mockReturnValueOnce(fetchStepLogsTable);  // outreach_step_logs (fetch all)

  // getCached for contacts and company
  mockGetCached.mockImplementation((key: string) => {
    if (key.startsWith("enriched:contacts:")) return Promise.resolve(contacts);
    if (key.startsWith("company:")) return Promise.resolve(company);
    if (key.startsWith("freshsales:intel:")) return Promise.resolve(null);
    return Promise.resolve(null);
  });

  // Draft API response
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => draftResponse,
  });
}

// For the last-step scenario, need different supabase chain
function stubLastStep() {
  mockCookieGet.mockImplementation((name: string) => {
    if (name === "user_name") return { value: "Adi" };
    return undefined;
  });

  const lastStepEnrollment = {
    ...ENROLLMENT,
    current_step: 2, // last step (index 2 of 3-step sequence)
  };

  const enrollmentTable = fakeTableSingle(lastStepEnrollment);
  const sequenceTable = fakeTableSingle({ steps: SEQUENCE_STEPS });
  const updateStepLogTable = fakeTableSingle();
  // No insert for next step when last step
  const updateEnrollmentTable = fakeTableSingle({
    ...UPDATED_ENROLLMENT,
    status: "completed",
    current_step: 3,
    next_step_due_at: null,
  });
  const fetchStepLogsTable = fakeTableList(STEP_LOGS);

  mockFrom
    .mockReturnValueOnce(enrollmentTable)
    .mockReturnValueOnce(sequenceTable)
    .mockReturnValueOnce(updateStepLogTable)   // mark completed
    .mockReturnValueOnce(updateEnrollmentTable) // complete enrollment
    .mockReturnValueOnce(fetchStepLogsTable);   // fetch all logs

  mockGetCached.mockImplementation((key: string) => {
    if (key.startsWith("enriched:contacts:")) return Promise.resolve(CACHED_CONTACTS);
    if (key.startsWith("company:")) return Promise.resolve(CACHED_COMPANY);
    return Promise.resolve(null);
  });

  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ message: "Draft LinkedIn note" }),
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  mockGetCached.mockReset();
  mockFrom.mockReset();
  mockCookieGet.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ===========================================================================
// POST /api/outreach/enrollments/[id]/execute
// ===========================================================================

describe("POST /api/outreach/enrollments/[id]/execute", () => {
  // -------------------------------------------------------------------------
  // Error cases
  // -------------------------------------------------------------------------

  it("returns 401 when no user_name cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 404 for missing enrollment", async () => {
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "user_name") return { value: "Adi" };
      return undefined;
    });

    const enrollmentTable = fakeTableSingle(null, { message: "not found" });
    mockFrom.mockReturnValue(enrollmentTable);

    const res = await POST(makeRequest(), makeParams("enr-missing"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Enrollment not found");
  });

  it("returns 400 for already-completed enrollment", async () => {
    stubHappyPath({ enrollmentStatus: "completed" });

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Can only execute steps on active enrollments");
  });

  it("returns 400 for paused enrollment", async () => {
    stubHappyPath({ enrollmentStatus: "paused" });

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Context resolution from cache
  // -------------------------------------------------------------------------

  it("resolves contactTitle from enrichedContacts cache", async () => {
    stubHappyPath();

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    // Verify the draft API was called with the contact's title from cache
    const draftCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(draftCallBody.contactTitle).toBe("VP of Sales");
    expect(draftCallBody.contactSeniority).toBe("vp");
  });

  it("resolves companyIndustry from company cache", async () => {
    stubHappyPath();

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    const draftCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(draftCallBody.companyIndustry).toBe("Technology");
  });

  it("resolves freshsalesStatus from company cache", async () => {
    stubHappyPath();

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    const draftCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(draftCallBody.freshsalesStatus).toBe("negotiation");
    expect(draftCallBody.hubspotStatus).toBe("lead");
  });

  it("passes real context to email draft API call", async () => {
    stubHappyPath();

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    // First fetch call is the draft API
    const draftCall = fetchMock.mock.calls[0];
    expect(draftCall[0]).toContain("/api/outreach/draft");
    const draftBody = JSON.parse(draftCall[1].body);
    expect(draftBody.contactName).toBe("Jane Doe");
    expect(draftBody.channel).toBe("email");
    expect(draftBody.tone).toBe("formal");
    expect(draftBody.template).toBe("intro");
    expect(draftBody.icpScore).toBe(78);
    expect(draftBody.signals).toHaveLength(1);
    expect(draftBody.signals[0].title).toBe("Acme raises $50M Series C");
  });

  it("passes real context to call step (talking points)", async () => {
    // Call step (index 1) requires a separate from("user_config") call,
    // so we build the full mock chain manually.
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "user_name") return { value: "Adi" };
      return undefined;
    });

    mockGetCached.mockImplementation((key: string) => {
      if (key.startsWith("enriched:contacts:")) return Promise.resolve(CACHED_CONTACTS);
      if (key.startsWith("company:")) return Promise.resolve(CACHED_COMPANY);
      return Promise.resolve(null);
    });

    const enrollmentTable = fakeTableSingle({ ...ENROLLMENT, current_step: 1 });
    const sequenceTable = fakeTableSingle({ steps: SEQUENCE_STEPS });
    const userConfigTable = fakeTableSingle({ freshsales_domain: "myra" });
    const updateStepLogTable = fakeTableSingle();
    const insertStepLogTable = fakeTableList();
    const updateEnrollmentTable = fakeTableSingle(UPDATED_ENROLLMENT);
    const fetchStepLogsTable = fakeTableList(STEP_LOGS);

    mockFrom
      .mockReturnValueOnce(enrollmentTable)      // 1. enrollment lookup
      .mockReturnValueOnce(sequenceTable)         // 2. sequence lookup
      .mockReturnValueOnce(userConfigTable)       // 3. user_config (call channel)
      .mockReturnValueOnce(updateStepLogTable)    // 4. mark step completed
      .mockReturnValueOnce(insertStepLogTable)    // 5. insert next step
      .mockReturnValueOnce(updateEnrollmentTable) // 6. advance enrollment
      .mockReturnValueOnce(fetchStepLogsTable);   // 7. fetch all step logs

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.executionResult.type).toBe("call");
    expect(body.executionResult.talkingPoints).toBe("Discuss pricing");
    expect(body.executionResult.companyDomain).toBe("acme.com");
    expect(body.executionResult.freshsalesUrl).toContain("myra.freshsales.io");
  });

  it("handles cache miss gracefully (empty defaults)", async () => {
    stubHappyPath({ contacts: null, company: null });

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    // Draft API should still be called with empty/default values
    const draftBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(draftBody.contactTitle).toBe("");
    expect(draftBody.companyIndustry).toBe("");
    expect(draftBody.freshsalesStatus).toBe("none");
    expect(draftBody.hubspotStatus).toBe("none");
  });

  // -------------------------------------------------------------------------
  // Step completion
  // -------------------------------------------------------------------------

  it("returns completed:true when last step", async () => {
    stubLastStep();

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.completed).toBe(true);
    expect(body.enrollment.status).toBe("completed");
  });

  it("returns completed:false when not last step", async () => {
    stubHappyPath();

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.completed).toBe(false);
    expect(body.enrollment.status).toBe("active");
  });

  it("returns executionResult with draft content for email", async () => {
    stubHappyPath({
      draftResponse: { subject: "Meeting request: Acme", message: "Hi Jane, ..." },
    });

    const res = await POST(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.executionResult.type).toBe("email_draft");
    expect(body.executionResult.subject).toBe("Meeting request: Acme");
    expect(body.executionResult.message).toBe("Hi Jane, ...");
  });

  it("returns stepLogs array in response", async () => {
    stubHappyPath();

    const res = await POST(makeRequest(), makeParams("enr-1"));
    const body = await res.json();

    expect(body.stepLogs).toHaveLength(2);
    expect(body.stepLogs[0].channel).toBe("email");
    expect(body.stepLogs[1].channel).toBe("call");
  });

  it("handles draft API failure gracefully (email)", async () => {
    stubHappyPath();
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const res = await POST(makeRequest(), makeParams("enr-1"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.executionResult.type).toBe("email_draft");
    expect(body.executionResult.error).toContain("Draft generation failed");
  });
});
