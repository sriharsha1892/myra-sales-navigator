import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — Clearout provider
// ---------------------------------------------------------------------------

const mockFindEmailsBatch = vi.fn();
vi.mock("@/lib/navigator/providers/clearout", () => ({
  findEmailsBatch: (...args: unknown[]) => mockFindEmailsBatch(...args),
}));

import { POST } from "@/app/api/contact/find-emails/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/contact/find-emails", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/contact/find-emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when domain is missing", async () => {
    const res = await POST(
      makeRequest({
        contacts: [{ firstName: "John", lastName: "Doe", contactId: "c1" }],
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain and contacts[] are required");
  });

  it("returns 400 when contacts array is missing", async () => {
    const res = await POST(makeRequest({ domain: "acme.com" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain and contacts[] are required");
  });

  it("returns 400 when contacts array is empty", async () => {
    const res = await POST(
      makeRequest({ domain: "acme.com", contacts: [] })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain and contacts[] are required");
  });

  it("calls findEmailsBatch and returns results on success", async () => {
    const batchResults = [
      { contactId: "c1", email: "john@acme.com", confidence: 90, status: "found" },
      { contactId: "c2", email: null, confidence: 0, status: "not_found" },
    ];
    mockFindEmailsBatch.mockResolvedValue(batchResults);

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contacts: [
          { firstName: "John", lastName: "Doe", contactId: "c1" },
          { firstName: "Jane", lastName: "Smith", contactId: "c2" },
        ],
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual(batchResults);

    // Verify findEmailsBatch was called with correct args
    expect(mockFindEmailsBatch).toHaveBeenCalledWith(
      [
        { contactId: "c1", firstName: "John", lastName: "Doe" },
        { contactId: "c2", firstName: "Jane", lastName: "Smith" },
      ],
      "acme.com",
      10 // maxLookups
    );
  });

  it("returns 500 with error message when findEmailsBatch throws", async () => {
    mockFindEmailsBatch.mockRejectedValue(new Error("Clearout credits exhausted"));

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contacts: [{ firstName: "John", lastName: "Doe", contactId: "c1" }],
      })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Clearout credits exhausted");
  });

  it("returns generic error message for non-Error throws", async () => {
    mockFindEmailsBatch.mockRejectedValue("unexpected string error");

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contacts: [{ firstName: "John", lastName: "Doe", contactId: "c1" }],
      })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Email finder failed");
  });
});
