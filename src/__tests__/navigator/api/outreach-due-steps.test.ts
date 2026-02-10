/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock fns
// ---------------------------------------------------------------------------

const { mockFrom, mockGetCached } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetCached: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — Supabase
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Mocks — cache
// ---------------------------------------------------------------------------

vi.mock("@/lib/cache", () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  CacheKeys: {
    enrichedContacts: (domain: string) => `enriched:contacts:${domain}`,
  },
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/outreach/due-steps/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: "enr-1",
    sequence_id: "seq-1",
    contact_id: "contact-1",
    company_domain: "acme.com",
    enrolled_by: "Adi",
    current_step: 0,
    status: "active",
    next_step_due_at: "2026-02-09T10:00:00Z",
    created_at: "2026-02-08T10:00:00Z",
    updated_at: "2026-02-08T10:00:00Z",
    ...overrides,
  };
}

function makeSequence(overrides: Record<string, unknown> = {}) {
  return {
    id: "seq-1",
    name: "Cold Outreach",
    description: "Standard cold outreach",
    is_template: false,
    created_by: "Adi",
    steps: JSON.stringify([
      { channel: "email", delayDays: 0, subject: "Intro" },
      { channel: "call", delayDays: 2 },
    ]),
    created_at: "2026-02-07T10:00:00Z",
    updated_at: "2026-02-07T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/outreach/due-steps", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCached.mockReset();
  });

  it("returns empty items when no active enrollments exist", async () => {
    mockFrom.mockReturnValue(fakeTable([], null));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("returns empty items when enrollments query returns null data", async () => {
    mockFrom.mockReturnValue(fakeTable(null, null));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("returns empty items when enrollments query errors", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { message: "DB connection failed" })
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("returns due steps with enrollment and sequence data", async () => {
    const enrollments = [makeEnrollment()];
    const sequences = [makeSequence()];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].enrollment.id).toBe("enr-1");
    expect(body.items[0].enrollment.sequenceId).toBe("seq-1");
    expect(body.items[0].enrollment.contactId).toBe("contact-1");
    expect(body.items[0].enrollment.companyDomain).toBe("acme.com");
    expect(body.items[0].enrollment.status).toBe("active");
    expect(body.items[0].sequence.name).toBe("Cold Outreach");
    expect(body.items[0].sequence.steps).toHaveLength(2);
  });

  it("resolves contact names from KV cache", async () => {
    const enrollments = [makeEnrollment()];
    const sequences = [makeSequence()];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockResolvedValue({
      contacts: [
        { id: "contact-1", firstName: "John", lastName: "Doe" },
      ],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.items[0].contactName).toBe("John Doe");
  });

  it("falls back to contactId when contact is not in cache", async () => {
    const enrollments = [makeEnrollment()];
    const sequences = [makeSequence()];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body.items[0].contactName).toBe("contact-1");
  });

  it("filters out items whose sequence has no steps", async () => {
    const enrollments = [
      makeEnrollment(),
      makeEnrollment({ id: "enr-2", sequence_id: "seq-2" }),
    ];
    const sequences = [
      makeSequence(),
      makeSequence({ id: "seq-2", steps: JSON.stringify([]) }),
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    // Only the first enrollment should survive (seq-2 has empty steps)
    expect(body.items).toHaveLength(1);
    expect(body.items[0].enrollment.id).toBe("enr-1");
  });

  it("handles sequence with no matching enrollment gracefully", async () => {
    const enrollments = [
      makeEnrollment({ sequence_id: "seq-missing" }),
    ];
    const sequences: unknown[] = [];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    // Unknown sequence has empty steps => filtered out
    expect(body.items).toHaveLength(0);
  });

  it("handles steps stored as a string (JSON)", async () => {
    const enrollments = [makeEnrollment()];
    const sequences = [
      makeSequence({
        steps: JSON.stringify([{ channel: "email", delayDays: 0 }]),
      }),
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body.items[0].sequence.steps).toHaveLength(1);
    expect(body.items[0].sequence.steps[0].channel).toBe("email");
  });

  it("handles steps stored as a parsed array", async () => {
    const enrollments = [makeEnrollment()];
    const sequences = [
      makeSequence({
        steps: [{ channel: "call", delayDays: 1 }],
      }),
    ];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(body.items[0].sequence.steps).toHaveLength(1);
    expect(body.items[0].sequence.steps[0].channel).toBe("call");
  });

  it("returns empty items when a general error is thrown", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("handles cache errors silently and still returns items", async () => {
    const enrollments = [makeEnrollment()];
    const sequences = [makeSequence()];

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(enrollments);
      if (callCount === 2) return fakeTable(sequences);
      return fakeTable([]);
    });

    mockGetCached.mockRejectedValue(new Error("KV timeout"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    // Contact name not resolved, falls back to contactId
    expect(body.items[0].contactName).toBe("contact-1");
  });
});
