/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { clearCache } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Environment stubs — BEFORE any module import
// ---------------------------------------------------------------------------

vi.stubEnv("FRESHSALES_API_KEY", "test-fs-key");
vi.stubEnv("FRESHSALES_DOMAIN", "testcompany");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-service-key");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Dynamic import so module-level _settingsCache reads stubbed env
let isFreshsalesAvailable: typeof import("@/lib/providers/freshsales").isFreshsalesAvailable;
let getFreshsalesIntel: typeof import("@/lib/providers/freshsales").getFreshsalesIntel;
let getFreshsalesContacts: typeof import("@/lib/providers/freshsales").getFreshsalesContacts;
let getFreshsalesStatus: typeof import("@/lib/providers/freshsales").getFreshsalesStatus;

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeOkResponse(body: unknown, headers?: Record<string, string>) {
  const h = new Headers(headers);
  return { ok: true, status: 200, json: async () => body, headers: h };
}

function makeErrorResponse(status: number) {
  return { ok: false, status, json: async () => ({}), headers: new Headers() };
}

function makeAccountResponse(accounts: Record<string, unknown>[]) {
  return makeOkResponse({ sales_accounts: accounts });
}

function makeContactResponse(contacts: Record<string, unknown>[]) {
  return makeOkResponse({ contacts });
}

function makeDealResponse(deals: Record<string, unknown>[]) {
  return makeOkResponse({ deals });
}

function makeRawContact(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@external.com",
    job_title: "VP of Sales",
    mobile_number: "+1555000111",
    work_number: "+1555000222",
    linkedin: "https://linkedin.com/in/janedoe",
    company: { name: "Acme Corp" },
    updated_at: "2025-12-01T00:00:00Z",
    ...overrides,
  };
}

function makeRawDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    name: "Acme Deal",
    amount: 50000,
    deal_stage: { name: "Negotiation" },
    probability: 60,
    expected_close: "2026-03-01",
    ...overrides,
  };
}

function makeSupabaseConfigResponse(settings?: Record<string, unknown>) {
  if (!settings) return makeOkResponse([]);
  return makeOkResponse([{ value: settings }]);
}

const DEFAULT_ACCOUNT = {
  id: 1,
  name: "Acme Corp",
  website: "https://acme.com",
  industry_type: { name: "Technology" },
  number_of_employees: 500,
};

/**
 * Wire up the standard 4-call fetch sequence:
 *   1. Supabase config
 *   2. Account search
 *   3. Contact search (parallel)
 *   4. Deal search (parallel)
 */
function stubHappyPath(
  opts: {
    config?: Record<string, unknown> | null;
    accounts?: Record<string, unknown>[];
    contacts?: Record<string, unknown>[];
    deals?: Record<string, unknown>[];
    rateHeaders?: Record<string, string>;
  } = {}
) {
  const {
    config = null,
    accounts = [DEFAULT_ACCOUNT],
    contacts = [makeRawContact()],
    deals = [makeRawDeal()],
    rateHeaders,
  } = opts;

  fetchMock
    .mockResolvedValueOnce(makeSupabaseConfigResponse(config ?? undefined)) // Supabase
    .mockResolvedValueOnce(
      rateHeaders
        ? makeOkResponse({ sales_accounts: accounts }, rateHeaders)
        : makeAccountResponse(accounts)
    ) // account search
    .mockResolvedValueOnce(makeContactResponse(contacts)) // contacts
    .mockResolvedValueOnce(makeDealResponse(deals)); // deals
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.stubEnv("FRESHSALES_API_KEY", "test-fs-key");
  vi.stubEnv("FRESHSALES_DOMAIN", "testcompany");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fake.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-service-key");
  fetchMock.mockReset();
  await clearCache();

  // Reset module to clear _settingsCache
  vi.resetModules();
  const mod = await import("@/lib/providers/freshsales");
  isFreshsalesAvailable = mod.isFreshsalesAvailable;
  getFreshsalesIntel = mod.getFreshsalesIntel;
  getFreshsalesContacts = mod.getFreshsalesContacts;
  getFreshsalesStatus = mod.getFreshsalesStatus;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// isFreshsalesAvailable
// ===========================================================================

describe("isFreshsalesAvailable", () => {
  it("returns true when API key + domain env vars set", () => {
    expect(isFreshsalesAvailable()).toBe(true);
  });

  it("returns false when FRESHSALES_API_KEY missing", () => {
    vi.stubEnv("FRESHSALES_API_KEY", "");
    expect(isFreshsalesAvailable()).toBe(false);
  });

  it("returns false when FRESHSALES_DOMAIN missing and no settings.domain", () => {
    vi.stubEnv("FRESHSALES_DOMAIN", "");
    expect(isFreshsalesAvailable()).toBe(false);
  });

  it("returns false when settings.enabled is false", () => {
    expect(
      isFreshsalesAvailable({ enabled: false, domain: "x" } as Parameters<typeof isFreshsalesAvailable>[0])
    ).toBe(false);
  });

  it("returns true when env domain missing but settings.domain provided", () => {
    vi.stubEnv("FRESHSALES_DOMAIN", "");
    expect(
      isFreshsalesAvailable({ enabled: true, domain: "custom" } as Parameters<typeof isFreshsalesAvailable>[0])
    ).toBe(true);
  });

  it("returns true when settings.enabled is undefined (defaults true)", () => {
    expect(
      isFreshsalesAvailable({ domain: "x" } as Parameters<typeof isFreshsalesAvailable>[0])
    ).toBe(true);
  });
});

// ===========================================================================
// getFreshsalesIntel — happy path
// ===========================================================================

describe("getFreshsalesIntel — happy path", () => {
  it("returns full FreshsalesIntel with account, contacts, deals", async () => {
    stubHappyPath();
    const result = await getFreshsalesIntel("acme.com");
    expect(result.domain).toBe("acme.com");
    expect(result.account).not.toBeNull();
    expect(result.account!.name).toBe("Acme Corp");
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.deals.length).toBeGreaterThan(0);
  });

  it("sends correct Authorization header", async () => {
    stubHappyPath();
    await getFreshsalesIntel("acme.com");
    // Call index 1 = account search (0 = supabase config)
    const accountCall = fetchMock.mock.calls[1];
    expect(accountCall[1].headers.Authorization).toBe("Token token=test-fs-key");
  });

  it("POSTs to correct URLs", async () => {
    stubHappyPath();
    await getFreshsalesIntel("acme.com");
    const urls = fetchMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(urls[1]).toContain("/filtered_search/sales_account");
    expect(urls[2]).toContain("/filtered_search/contact");
    expect(urls[3]).toContain("/filtered_search/deal");
  });

  it("sends correct body for account search (website contains normalized domain)", async () => {
    stubHappyPath();
    await getFreshsalesIntel("WWW.Acme.COM");
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.filter_rule[0]).toEqual({
      attribute: "website",
      operator: "contains",
      value: "acme.com",
    });
  });

  it("sends correct body for contact search (sales_account_id is_in)", async () => {
    stubHappyPath();
    await getFreshsalesIntel("acme.com");
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.filter_rule[0]).toEqual({
      attribute: "sales_account_id",
      operator: "is_in",
      value: 1,
    });
  });

  it("sends correct body for deal search (sales_account_id is_in)", async () => {
    stubHappyPath();
    await getFreshsalesIntel("acme.com");
    const body = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(body.filter_rule[0]).toEqual({
      attribute: "sales_account_id",
      operator: "is_in",
      value: 1,
    });
  });

  it("uses first account when multiple returned", async () => {
    stubHappyPath({
      accounts: [
        { id: 10, name: "First", website: "first.com" },
        { id: 20, name: "Second", website: "second.com" },
      ],
    });
    const result = await getFreshsalesIntel("acme.com");
    expect(result.account!.id).toBe(10);
    expect(result.account!.name).toBe("First");
  });

  it("fetches contacts + deals in parallel (both called)", async () => {
    stubHappyPath();
    await getFreshsalesIntel("acme.com");
    // Supabase(0) + account(1) + contacts(2) + deals(3)
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// ===========================================================================
// getFreshsalesIntel — account not found
// ===========================================================================

describe("getFreshsalesIntel — account not found", () => {
  it("returns EMPTY_INTEL (status 'none') when sales_accounts empty", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse()) // config
      .mockResolvedValueOnce(makeAccountResponse([])); // empty accounts
    const result = await getFreshsalesIntel("unknown.com");
    expect(result.status).toBe("none");
    expect(result.account).toBeNull();
    expect(result.contacts).toEqual([]);
    expect(result.deals).toEqual([]);
  });

  it("does not cache empty result when companyName not provided", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([]));
    await getFreshsalesIntel("unknown.com");

    // Second call without companyName — code skips caching so it re-fetches
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([]));
    const result = await getFreshsalesIntel("unknown.com");
    expect(result.status).toBe("none");
    // 4 fetches total (2 per call, since empty results aren't cached without companyName)
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// ===========================================================================
// getFreshsalesIntel — HTTP errors
// ===========================================================================

describe("getFreshsalesIntel — HTTP errors", () => {
  it("returns EMPTY_INTEL on account search 401", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeErrorResponse(401));
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("none");
  });

  it("returns EMPTY_INTEL on account search 500", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeErrorResponse(500));
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("none");
  });

  it("does not cache failures — transient errors allow retries", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeErrorResponse(500));
    await getFreshsalesIntel("fail.com");

    // Second call re-fetches since failures are not cached
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeErrorResponse(500));
    const result = await getFreshsalesIntel("fail.com");
    expect(result.status).toBe("none");
    // 4 fetches total (2 per call)
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("logs console.warn on failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeErrorResponse(500));
    await getFreshsalesIntel("acme.com");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Freshsales] Account search failed")
    );
    warnSpy.mockRestore();
  });
});

// ===========================================================================
// getFreshsalesIntel — partial failures
// ===========================================================================

describe("getFreshsalesIntel — partial failures", () => {
  it("empty contacts when contact fetch returns non-ok (deals still populated)", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeErrorResponse(500)) // contacts fail
      .mockResolvedValueOnce(makeDealResponse([makeRawDeal()])); // deals ok
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getFreshsalesIntel("acme.com");
    expect(result.contacts).toEqual([]);
    expect(result.deals.length).toBeGreaterThan(0);
  });

  it("empty deals when deal fetch returns non-ok (contacts still populated)", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([makeRawContact()])) // contacts ok
      .mockResolvedValueOnce(makeErrorResponse(500)); // deals fail
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getFreshsalesIntel("acme.com");
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.deals).toEqual([]);
  });

  it("both sub-fetches fail → account populated, status 'new_lead'", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeErrorResponse(500))
      .mockResolvedValueOnce(makeErrorResponse(500));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await getFreshsalesIntel("acme.com");
    expect(result.account).not.toBeNull();
    expect(result.status).toBe("new_lead");
  });

  it("contact fetch throws network error → deals still present", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockRejectedValueOnce(new Error("Network error")) // contacts throw
      .mockResolvedValueOnce(makeDealResponse([makeRawDeal()])); // deals ok
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getFreshsalesIntel("acme.com");
    expect(result.contacts).toEqual([]);
    expect(result.deals.length).toBeGreaterThan(0);
  });

  it("deal fetch throws network error → contacts still present", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([makeRawContact()]))
      .mockRejectedValueOnce(new Error("Network error")); // deals throw
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getFreshsalesIntel("acme.com");
    expect(result.contacts.length).toBeGreaterThan(0);
    expect(result.deals).toEqual([]);
  });
});

// ===========================================================================
// getFreshsalesIntel — network error
// ===========================================================================

describe("getFreshsalesIntel — network error", () => {
  it("returns EMPTY_INTEL when account search throws", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockRejectedValueOnce(new Error("Network failure"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("none");
    expect(result.account).toBeNull();
  });

  it("logs console.error", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockRejectedValueOnce(new Error("Network failure"));
    await getFreshsalesIntel("acme.com");
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Freshsales] getFreshsalesIntel error"),
      expect.any(Error)
    );
    errSpy.mockRestore();
  });
});

// ===========================================================================
// getFreshsalesIntel — not available
// ===========================================================================

describe("getFreshsalesIntel — not available", () => {
  it("returns EMPTY_INTEL without any API fetch when key missing", async () => {
    vi.stubEnv("FRESHSALES_API_KEY", "");
    // Re-import to pick up changed env
    vi.resetModules();
    const mod = await import("@/lib/providers/freshsales");
    // Supabase config call may still happen, but no account/contact/deal calls
    fetchMock.mockResolvedValueOnce(makeSupabaseConfigResponse());
    const result = await mod.getFreshsalesIntel("acme.com");
    expect(result.status).toBe("none");
    // At most 1 call (supabase config), no Freshsales API calls
    const freshsalesCalls = fetchMock.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("freshsales.io")
    );
    expect(freshsalesCalls).toHaveLength(0);
  });
});

// ===========================================================================
// caching
// ===========================================================================

describe("caching", () => {
  it("second call returns cached, fetch called only once", async () => {
    stubHappyPath();
    const first = await getFreshsalesIntel("acme.com");
    const second = await getFreshsalesIntel("acme.com");
    expect(second).toEqual(first);
    // 4 fetches from first call only
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("different domains make separate fetches", async () => {
    stubHappyPath();
    await getFreshsalesIntel("acme.com");

    // Second domain
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse()) // config (may be cached in module)
      .mockResolvedValueOnce(makeAccountResponse([{ ...DEFAULT_ACCOUNT, id: 2, name: "Beta" }]))
      .mockResolvedValueOnce(makeContactResponse([]))
      .mockResolvedValueOnce(makeDealResponse([]));
    await getFreshsalesIntel("beta.com");

    // At least 5 total fetches (4 for first + more for second)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("'WWW.ACME.COM' and 'acme.com' share cache", async () => {
    stubHappyPath();
    await getFreshsalesIntel("WWW.ACME.COM");
    const result = await getFreshsalesIntel("acme.com");
    expect(result.domain).toBe("acme.com");
    // Only 4 fetches total — second call used cache
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// ===========================================================================
// contact mapping
// ===========================================================================

describe("contact mapping", () => {
  it("maps raw fields correctly", async () => {
    stubHappyPath({ contacts: [makeRawContact()] });
    const result = await getFreshsalesIntel("acme.com");
    const c = result.contacts[0];
    expect(c.id).toBe("freshsales-101");
    expect(c.firstName).toBe("Jane");
    expect(c.lastName).toBe("Doe");
    expect(c.email).toBe("jane@external.com");
    expect(c.title).toBe("VP of Sales");
    expect(c.linkedinUrl).toBe("https://linkedin.com/in/janedoe");
  });

  it("emailConfidence 75 when email present, 0 when absent", async () => {
    stubHappyPath({
      contacts: [
        makeRawContact({ email: "has@email.com" }),
        makeRawContact({ id: 102, email: null }),
      ],
    });
    const result = await getFreshsalesIntel("acme.com");
    const withEmail = result.contacts.find((c) => c.email === "has@email.com");
    const withoutEmail = result.contacts.find((c) => c.email === null);
    expect(withEmail?.emailConfidence).toBe(75);
    expect(withoutEmail?.emailConfidence).toBe(0);
  });

  it("sources always ['freshsales']", async () => {
    stubHappyPath({ contacts: [makeRawContact()] });
    const result = await getFreshsalesIntel("acme.com");
    expect(result.contacts[0].sources).toEqual(["freshsales"]);
  });

  it("phone falls back mobile_number → work_number", async () => {
    stubHappyPath({
      contacts: [
        makeRawContact({ mobile_number: "+1111", work_number: "+2222" }),
        makeRawContact({ id: 103, mobile_number: null, work_number: "+3333" }),
      ],
    });
    const result = await getFreshsalesIntel("acme.com");
    const first = result.contacts.find((c) => c.phone === "+1111");
    const second = result.contacts.find((c) => c.phone === "+3333");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });

  it("companyName falls back to domain when company.name missing", async () => {
    stubHappyPath({
      contacts: [makeRawContact({ company: {} })],
    });
    const result = await getFreshsalesIntel("acme.com");
    expect(result.contacts[0].companyName).toBe("acme.com");
  });
});

// ===========================================================================
// seniority mapping
// ===========================================================================

describe("seniority mapping", () => {
  let seniorityCounter = 0;
  async function seniorityFor(title: string): Promise<string> {
    seniorityCounter++;
    await clearCache();
    vi.resetModules();
    const mod = await import("@/lib/providers/freshsales");
    fetchMock.mockReset();
    const domain = `seniority-${seniorityCounter}.com`;
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([makeRawContact({ job_title: title })]))
      .mockResolvedValueOnce(makeDealResponse([]));
    const result = await mod.getFreshsalesIntel(domain);
    return result.contacts[0]?.seniority ?? "unknown";
  }

  it("CEO/CTO/Chief/Founder → c_level", async () => {
    expect(await seniorityFor("CEO")).toBe("c_level");
    expect(await seniorityFor("Chief Technology Officer")).toBe("c_level");
    expect(await seniorityFor("Co-Founder")).toBe("c_level");
  });

  it("VP/Vice President → vp", async () => {
    expect(await seniorityFor("VP of Sales")).toBe("vp");
    expect(await seniorityFor("Vice President Engineering")).toBe("vp");
  });

  it("Director → director", async () => {
    expect(await seniorityFor("Director of Marketing")).toBe("director");
  });

  it("Manager/Head of → manager", async () => {
    expect(await seniorityFor("Product Manager")).toBe("manager");
    expect(await seniorityFor("Head of Growth")).toBe("manager");
  });

  it("null/empty/'Sales Associate' → staff", async () => {
    expect(await seniorityFor("Sales Associate")).toBe("staff");
    expect(await seniorityFor("")).toBe("staff");
  });
});

// ===========================================================================
// deal mapping
// ===========================================================================

describe("deal mapping", () => {
  it("deal_stage.name → stage, fallback to deal_stage_id → 'Unknown'", async () => {
    stubHappyPath({
      deals: [
        makeRawDeal({ deal_stage: { name: "Proposal" } }),
        makeRawDeal({ id: 502, deal_stage: null, deal_stage_id: "stage_42" }),
        makeRawDeal({ id: 503, deal_stage: null, deal_stage_id: null }),
      ],
    });
    const result = await getFreshsalesIntel("acme.com");
    expect(result.deals[0].stage).toBe("Proposal");
    expect(result.deals[1].stage).toBe("stage_42");
    expect(result.deals[2].stage).toBe("Unknown");
  });

  it("amount/probability/expectedClose mapped, null when absent", async () => {
    stubHappyPath({
      deals: [
        makeRawDeal({ amount: 10000, probability: 80, expected_close: "2026-06-01" }),
        makeRawDeal({ id: 504, amount: null, probability: null, expected_close: null }),
      ],
    });
    const result = await getFreshsalesIntel("acme.com");
    expect(result.deals[0].amount).toBe(10000);
    expect(result.deals[0].probability).toBe(80);
    expect(result.deals[0].expectedClose).toBe("2026-06-01");
    expect(result.deals[1].amount).toBeNull();
    expect(result.deals[1].probability).toBeNull();
    expect(result.deals[1].expectedClose).toBeNull();
  });
});

// ===========================================================================
// deriveStatus
// ===========================================================================

describe("deriveStatus", () => {
  function stubWithDeals(deals: Record<string, unknown>[]) {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse())
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([]))
      .mockResolvedValueOnce(makeDealResponse(deals));
  }

  it("no deals → 'new_lead'", async () => {
    stubWithDeals([]);
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("new_lead");
  });

  it("stage 'Won' → 'won'", async () => {
    stubWithDeals([makeRawDeal({ deal_stage: { name: "Won" } })]);
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("won");
  });

  it("stage 'Closed Won' → 'won'", async () => {
    stubWithDeals([makeRawDeal({ deal_stage: { name: "Closed Won" } })]);
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("won");
  });

  it("stage 'Lost' → 'lost'", async () => {
    stubWithDeals([makeRawDeal({ deal_stage: { name: "Lost" } })]);
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("lost");
  });

  it("active stage → 'negotiation'", async () => {
    stubWithDeals([makeRawDeal({ deal_stage: { name: "Proposal Sent" } })]);
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("negotiation");
  });

  it("'Won' priority over 'Lost' when both present", async () => {
    stubWithDeals([
      makeRawDeal({ id: 601, deal_stage: { name: "Lost" } }),
      makeRawDeal({ id: 602, deal_stage: { name: "Won" } }),
    ]);
    const result = await getFreshsalesIntel("acme.com");
    expect(result.status).toBe("won");
  });
});

// ===========================================================================
// config loading
// ===========================================================================

describe("config loading", () => {
  it("uses Supabase settings when returned", async () => {
    const customSettings = {
      enabled: true,
      domain: "custom-domain",
      cacheTtlMinutes: 99,
      sectionTitle: "Custom",
      emptyStateLabel: "N/A",
      statusLabels: {},
      showDeals: true,
      showContacts: true,
      showActivity: true,
      recentActivityDaysThreshold: 30,
    };
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse(customSettings))
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([]))
      .mockResolvedValueOnce(makeDealResponse([]));
    const result = await getFreshsalesIntel("acme.com");
    // Should use custom domain in the base URL
    const accountUrl = fetchMock.mock.calls[1][0] as string;
    expect(accountUrl).toContain("custom-domain.freshsales.io");
    expect(result.account).not.toBeNull();
  });

  it("falls back to defaults when Supabase env vars missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.resetModules();
    const mod = await import("@/lib/providers/freshsales");

    // No supabase call, goes straight to account search using default settings
    fetchMock
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([]))
      .mockResolvedValueOnce(makeDealResponse([]));
    const result = await mod.getFreshsalesIntel("acme.com");
    expect(result.account).not.toBeNull();
  });

  it("falls back to defaults on Supabase error", async () => {
    fetchMock
      .mockResolvedValueOnce(makeErrorResponse(500)) // supabase fails
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([]))
      .mockResolvedValueOnce(makeDealResponse([]));
    const result = await getFreshsalesIntel("acme.com");
    expect(result.account).not.toBeNull();
  });

  it("falls back to defaults on empty rows", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSupabaseConfigResponse()) // empty array
      .mockResolvedValueOnce(makeAccountResponse([DEFAULT_ACCOUNT]))
      .mockResolvedValueOnce(makeContactResponse([]))
      .mockResolvedValueOnce(makeDealResponse([]));
    const result = await getFreshsalesIntel("acme.com");
    expect(result.account).not.toBeNull();
  });
});

// ===========================================================================
// rate limit warning
// ===========================================================================

describe("rate limit warning", () => {
  it("console.warn when X-Ratelimit-Remaining < 100", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubHappyPath({ rateHeaders: { "X-Ratelimit-Remaining": "42" } });
    await getFreshsalesIntel("acme.com");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Rate limit low")
    );
    warnSpy.mockRestore();
  });

  it("no warning when >= 100 or absent", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubHappyPath({ rateHeaders: { "X-Ratelimit-Remaining": "500" } });
    await getFreshsalesIntel("acme.com");
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Rate limit low")
    );
    warnSpy.mockRestore();
  });
});

// ===========================================================================
// lastContactDate
// ===========================================================================

describe("lastContactDate", () => {
  it("picks most recent lastVerified from contacts", async () => {
    stubHappyPath({
      contacts: [
        makeRawContact({ id: 201, updated_at: "2025-06-01T00:00:00Z" }),
        makeRawContact({ id: 202, updated_at: "2025-12-15T00:00:00Z" }),
        makeRawContact({ id: 203, updated_at: "2025-09-01T00:00:00Z" }),
      ],
    });
    const result = await getFreshsalesIntel("acme.com");
    expect(result.lastContactDate).toBe("2025-12-15T00:00:00Z");
  });

  it("null when no contacts have updated_at", async () => {
    stubHappyPath({
      contacts: [
        makeRawContact({ id: 204, updated_at: null }),
        makeRawContact({ id: 205, updated_at: undefined }),
      ],
    });
    const result = await getFreshsalesIntel("acme.com");
    expect(result.lastContactDate).toBeNull();
  });
});

// ===========================================================================
// thin wrappers
// ===========================================================================

describe("thin wrappers", () => {
  it("getFreshsalesContacts → intel.contacts", async () => {
    stubHappyPath({ contacts: [makeRawContact()] });
    const contacts = await getFreshsalesContacts("acme.com");
    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts[0].firstName).toBe("Jane");
  });

  it("getFreshsalesStatus → intel.status", async () => {
    stubHappyPath({ deals: [makeRawDeal({ deal_stage: { name: "Won" } })] });
    const status = await getFreshsalesStatus("acme.com");
    expect(status).toBe("won");
  });
});
