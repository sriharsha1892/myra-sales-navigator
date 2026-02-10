/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mock fns
// ---------------------------------------------------------------------------

const { mockCookieGet, mockFrom } = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockFrom: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — next/headers (cookies)
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

// ---------------------------------------------------------------------------
// Mocks — Supabase
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------

import { GET, PUT } from "@/app/api/outreach/enrollments/[id]/route";

// ---------------------------------------------------------------------------
// Supabase chain helper
// ---------------------------------------------------------------------------

function fakeTable(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return chain;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDbEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: "enr-1",
    sequence_id: "seq-1",
    contact_id: "contact-1",
    company_domain: "acme.com",
    enrolled_by: "Adi",
    current_step: 0,
    status: "active",
    next_step_due_at: "2026-02-10T10:00:00Z",
    created_at: "2026-02-09T10:00:00Z",
    updated_at: "2026-02-09T10:00:00Z",
    ...overrides,
  };
}

function makeDbStepLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "sl-1",
    enrollment_id: "enr-1",
    step_index: 0,
    channel: "email",
    status: "pending",
    completed_at: null,
    outcome: null,
    notes: null,
    draft_content: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: Record<string, unknown>): NextRequest {
  const init: Record<string, unknown> = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest("http://localhost/api/outreach/enrollments/enr-1", init);
}

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe("GET /api/outreach/enrollments/[id]", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("returns enrollment with step logs", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Fetch enrollment
        return fakeTable(makeDbEnrollment());
      }
      // Fetch step logs
      return fakeTable([makeDbStepLog()]);
    });

    const res = await GET(makeRequest("GET"), makeParams("enr-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollment.id).toBe("enr-1");
    expect(body.enrollment.sequenceId).toBe("seq-1");
    expect(body.enrollment.contactId).toBe("contact-1");
    expect(body.enrollment.companyDomain).toBe("acme.com");
    expect(body.enrollment.status).toBe("active");
    expect(body.stepLogs).toHaveLength(1);
    expect(body.stepLogs[0].enrollmentId).toBe("enr-1");
    expect(body.stepLogs[0].stepIndex).toBe(0);
    expect(body.stepLogs[0].channel).toBe("email");
    expect(body.stepLogs[0].status).toBe("pending");
  });

  it("returns 404 when enrollment not found", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { code: "PGRST116" })
    );

    const res = await GET(makeRequest("GET"), makeParams("nonexistent"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Enrollment not found");
  });

  it("returns empty stepLogs when none exist", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return fakeTable(makeDbEnrollment());
      return fakeTable(null);
    });

    const res = await GET(makeRequest("GET"), makeParams("enr-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stepLogs).toEqual([]);
  });

  it("returns 500 on unexpected error", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const res = await GET(makeRequest("GET"), makeParams("enr-1"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to fetch enrollment");
  });
});

// ---------------------------------------------------------------------------
// Tests — PUT
// ---------------------------------------------------------------------------

describe("PUT /api/outreach/enrollments/[id]", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    mockFrom.mockReset();
    mockCookieGet.mockImplementation((name: string) => {
      if (name === "user_name") return { value: "Adi" };
      return undefined;
    });
  });

  it("returns 401 when user_name cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await PUT(
      makeRequest("PUT", { action: "pause" }),
      makeParams("enr-1")
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 400 when action is missing", async () => {
    const res = await PUT(
      makeRequest("PUT", {}),
      makeParams("enr-1")
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required field: action");
  });

  it("returns 400 for invalid action", async () => {
    const res = await PUT(
      makeRequest("PUT", { action: "restart" }),
      makeParams("enr-1")
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid action/);
  });

  it("returns 404 when enrollment not found", async () => {
    mockFrom.mockReturnValue(
      fakeTable(null, { code: "PGRST116" })
    );

    const res = await PUT(
      makeRequest("PUT", { action: "pause" }),
      makeParams("nonexistent")
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Enrollment not found");
  });

  // --- Pause ---

  it("pauses an active enrollment", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Fetch enrollment
        return fakeTable(makeDbEnrollment({ status: "active" }));
      }
      // Update to paused
      return fakeTable(makeDbEnrollment({ status: "paused" }));
    });

    const res = await PUT(
      makeRequest("PUT", { action: "pause" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollment.status).toBe("paused");
  });

  it("returns 400 when pausing a non-active enrollment", async () => {
    mockFrom.mockReturnValue(
      fakeTable(makeDbEnrollment({ status: "paused" }))
    );

    const res = await PUT(
      makeRequest("PUT", { action: "pause" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Can only pause active enrollments");
  });

  // --- Resume ---

  it("resumes a paused enrollment", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeTable(makeDbEnrollment({ status: "paused" }));
      }
      return fakeTable(makeDbEnrollment({ status: "active" }));
    });

    const res = await PUT(
      makeRequest("PUT", { action: "resume" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollment.status).toBe("active");
  });

  it("returns 400 when resuming a non-paused enrollment", async () => {
    mockFrom.mockReturnValue(
      fakeTable(makeDbEnrollment({ status: "active" }))
    );

    const res = await PUT(
      makeRequest("PUT", { action: "resume" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Can only resume paused enrollments");
  });

  // --- Unenroll ---

  it("unenrolls an active enrollment", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeTable(makeDbEnrollment({ status: "active" }));
      }
      return fakeTable(makeDbEnrollment({ status: "unenrolled" }));
    });

    const res = await PUT(
      makeRequest("PUT", { action: "unenroll" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollment.status).toBe("unenrolled");
  });

  it("unenrolls a paused enrollment", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeTable(makeDbEnrollment({ status: "paused" }));
      }
      return fakeTable(makeDbEnrollment({ status: "unenrolled" }));
    });

    const res = await PUT(
      makeRequest("PUT", { action: "unenroll" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollment.status).toBe("unenrolled");
  });

  it("returns 400 when unenrolling a completed enrollment", async () => {
    mockFrom.mockReturnValue(
      fakeTable(makeDbEnrollment({ status: "completed" }))
    );

    const res = await PUT(
      makeRequest("PUT", { action: "unenroll" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Enrollment is already finished");
  });

  it("returns 400 when unenrolling an already unenrolled enrollment", async () => {
    mockFrom.mockReturnValue(
      fakeTable(makeDbEnrollment({ status: "unenrolled" }))
    );

    const res = await PUT(
      makeRequest("PUT", { action: "unenroll" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Enrollment is already finished");
  });

  // --- Advance ---

  it("returns 400 when advancing a non-active enrollment", async () => {
    mockFrom.mockReturnValue(
      fakeTable(makeDbEnrollment({ status: "paused" }))
    );

    const res = await PUT(
      makeRequest("PUT", { action: "advance" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Can only advance active enrollments");
  });

  it("advances to next step when more steps remain", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Fetch enrollment (at step 0)
        return fakeTable(makeDbEnrollment({ status: "active", current_step: 0 }));
      }
      if (callCount === 2) {
        // Fetch sequence
        return fakeTable({
          steps: JSON.stringify([
            { channel: "email", delayDays: 0 },
            { channel: "call", delayDays: 2 },
          ]),
        });
      }
      if (callCount === 3) {
        // Update step log (mark current step completed)
        return fakeTable(null);
      }
      if (callCount === 4) {
        // Insert next step log
        return fakeTable(null);
      }
      // Update enrollment (advance to step 1)
      return fakeTable(makeDbEnrollment({ current_step: 1, status: "active" }));
    });

    const res = await PUT(
      makeRequest("PUT", { action: "advance", outcome: "sent", notes: "Email delivered" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollment.currentStep).toBe(1);
    expect(body.completed).toBe(false);
  });

  it("completes enrollment when advancing past last step", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Fetch enrollment (at step 1, last step of 2-step sequence)
        return fakeTable(makeDbEnrollment({ status: "active", current_step: 1 }));
      }
      if (callCount === 2) {
        // Fetch sequence
        return fakeTable({
          steps: JSON.stringify([
            { channel: "email", delayDays: 0 },
            { channel: "call", delayDays: 2 },
          ]),
        });
      }
      if (callCount === 3) {
        // Update step log (mark current step completed)
        return fakeTable(null);
      }
      // Update enrollment to completed
      return fakeTable(
        makeDbEnrollment({
          current_step: 2,
          status: "completed",
          next_step_due_at: null,
        })
      );
    });

    const res = await PUT(
      makeRequest("PUT", { action: "advance" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enrollment.status).toBe("completed");
    expect(body.completed).toBe(true);
  });

  it("returns 500 when sequence not found during advance", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeTable(makeDbEnrollment({ status: "active" }));
      }
      // Sequence fetch fails
      return fakeTable(null, { code: "PGRST116" });
    });

    const res = await PUT(
      makeRequest("PUT", { action: "advance" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Sequence not found");
  });

  it("returns 500 on unexpected error", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const res = await PUT(
      makeRequest("PUT", { action: "pause" }),
      makeParams("enr-1")
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to update enrollment");
  });
});
