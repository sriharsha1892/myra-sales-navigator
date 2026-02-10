import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Supabase server client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/team-activity/daily-summary/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a chainable Supabase table mock.
 * The chain terminates via .then() which resolves with { data, error }.
 * This matches the pattern used by Promise.allSettled — the Supabase query
 * builder is thenable, so allSettled sees it as a promise.
 */
function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.then = (
    resolve: (v: unknown) => void,
    reject?: (v: unknown) => void
  ) => {
    // If error and reject exist, reject the promise for allSettled "rejected"
    if (error && reject) {
      reject(error);
    } else {
      resolve({ data, error });
    }
  };
  return chain;
}

/**
 * Creates a thenable that rejects (for Promise.allSettled "rejected" case).
 */
function failingTable(errorMsg: string) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.then = (
    _resolve: (v: unknown) => void,
    reject?: (v: unknown) => void
  ) => {
    if (reject) reject(new Error(errorMsg));
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/team-activity/daily-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Returns all zeros when no sessions exist
  // -----------------------------------------------------------------------

  it("returns all zeros when no sessions exist", async () => {
    const sessionsTable = fakeTable([]);
    const stepsTable = fakeTable([]);
    mockFrom
      .mockReturnValueOnce(sessionsTable)
      .mockReturnValueOnce(stepsTable);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({
      companiesReviewed: 0,
      contactsExported: 0,
      outreachSteps: 0,
      activeMembers: 0,
    });
  });

  // -----------------------------------------------------------------------
  // Aggregates company_view_count across sessions
  // -----------------------------------------------------------------------

  it("aggregates company_view_count across sessions", async () => {
    const sessionsData = [
      { user_name: "Adi", company_view_count: 10, export_count: 0 },
      { user_name: "Satish", company_view_count: 15, export_count: 0 },
      { user_name: "Adi", company_view_count: 5, export_count: 0 },
    ];
    const stepsData: unknown[] = [];

    mockFrom
      .mockReturnValueOnce(fakeTable(sessionsData))
      .mockReturnValueOnce(fakeTable(stepsData));

    const res = await GET();
    const body = await res.json();

    expect(body.companiesReviewed).toBe(30); // 10 + 15 + 5
  });

  // -----------------------------------------------------------------------
  // Aggregates export_count (contactsExported)
  // -----------------------------------------------------------------------

  it("aggregates export_count as contactsExported", async () => {
    const sessionsData = [
      { user_name: "Adi", company_view_count: 0, export_count: 3 },
      { user_name: "Satish", company_view_count: 0, export_count: 7 },
    ];

    mockFrom
      .mockReturnValueOnce(fakeTable(sessionsData))
      .mockReturnValueOnce(fakeTable([]));

    const res = await GET();
    const body = await res.json();

    expect(body.contactsExported).toBe(10); // 3 + 7
  });

  // -----------------------------------------------------------------------
  // Counts unique active members (dedup by user_name)
  // -----------------------------------------------------------------------

  it("counts unique active members (dedup by user_name)", async () => {
    const sessionsData = [
      { user_name: "Adi", company_view_count: 5, export_count: 1 },
      { user_name: "Adi", company_view_count: 3, export_count: 2 },
      { user_name: "Satish", company_view_count: 10, export_count: 0 },
      { user_name: "Nikita", company_view_count: 2, export_count: 1 },
    ];

    mockFrom
      .mockReturnValueOnce(fakeTable(sessionsData))
      .mockReturnValueOnce(fakeTable([]));

    const res = await GET();
    const body = await res.json();

    // Adi appears twice but should only count once
    expect(body.activeMembers).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Counts completed outreach steps
  // -----------------------------------------------------------------------

  it("counts completed outreach steps", async () => {
    const stepsData = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

    mockFrom
      .mockReturnValueOnce(fakeTable([]))
      .mockReturnValueOnce(fakeTable(stepsData));

    const res = await GET();
    const body = await res.json();

    expect(body.outreachSteps).toBe(3);
  });

  // -----------------------------------------------------------------------
  // Handles null numeric fields as 0
  // -----------------------------------------------------------------------

  it("handles null numeric fields as 0", async () => {
    const sessionsData = [
      { user_name: "Adi", company_view_count: null, export_count: null },
      { user_name: "Satish", company_view_count: 5, export_count: null },
    ];

    mockFrom
      .mockReturnValueOnce(fakeTable(sessionsData))
      .mockReturnValueOnce(fakeTable([]));

    const res = await GET();
    const body = await res.json();

    expect(body.companiesReviewed).toBe(5); // 0 + 5
    expect(body.contactsExported).toBe(0); // 0 + 0
    expect(body.activeMembers).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Handles partial Promise.allSettled failure
  // -----------------------------------------------------------------------

  it("handles partial Promise.allSettled failure (sessions fail, steps succeed)", async () => {
    mockFrom
      .mockReturnValueOnce(failingTable("sessions query failed"))
      .mockReturnValueOnce(fakeTable([{ id: "s1" }, { id: "s2" }]));

    const res = await GET();
    const body = await res.json();

    // Sessions failed → zeros for session-derived metrics
    expect(body.companiesReviewed).toBe(0);
    expect(body.contactsExported).toBe(0);
    expect(body.activeMembers).toBe(0);
    // Steps succeeded
    expect(body.outreachSteps).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Returns 0s when both queries fail
  // -----------------------------------------------------------------------

  it("returns 0s when both queries fail", async () => {
    mockFrom
      .mockReturnValueOnce(failingTable("sessions query failed"))
      .mockReturnValueOnce(failingTable("steps query failed"));

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({
      companiesReviewed: 0,
      contactsExported: 0,
      outreachSteps: 0,
      activeMembers: 0,
    });
  });
});
