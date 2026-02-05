import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — cache module
// ---------------------------------------------------------------------------

const mockGetCached = vi.fn();
const mockSetCached = vi.fn();

vi.mock("@/lib/cache", () => ({
  getCached: (...args: unknown[]) => mockGetCached(...args),
  setCached: (...args: unknown[]) => mockSetCached(...args),
  CacheKeys: {
    enrichedContacts: (domain: string) => `enriched:contacts:${domain.toLowerCase().replace(/^www\./, "").trim()}`,
  },
  CacheTTL: {
    enrichedContacts: 120,
  },
  normalizeDomain: (domain: string) => domain.toLowerCase().replace(/^www\./, "").trim(),
}));

import { POST } from "@/app/api/contact/persist-email/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/contact/persist-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/contact/persist-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetCached.mockResolvedValue(undefined);
  });

  it("returns 400 when domain is missing", async () => {
    const res = await POST(
      makeRequest({ contactId: "c1", email: "john@acme.com" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain, contactId, and email are required");
  });

  it("returns 400 when contactId is missing", async () => {
    const res = await POST(
      makeRequest({ domain: "acme.com", email: "john@acme.com" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain, contactId, and email are required");
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(
      makeRequest({ domain: "acme.com", contactId: "c1" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("domain, contactId, and email are required");
  });

  it("returns persisted: false with reason cache_miss when cache has no entry", async () => {
    mockGetCached.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contactId: "c1",
        email: "john@acme.com",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.persisted).toBe(false);
    expect(body.reason).toBe("cache_miss");
  });

  it("returns persisted: false with reason contact_not_found when contact ID is not in cache", async () => {
    mockGetCached.mockResolvedValue({
      contacts: [{ id: "other-contact", email: null }],
      sources: { apollo: true },
    });

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contactId: "c1",
        email: "john@acme.com",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.persisted).toBe(false);
    expect(body.reason).toBe("contact_not_found");
  });

  it("persists email to cache and returns persisted: true on success", async () => {
    const cachedData = {
      contacts: [
        { id: "c1", email: null, emailConfidence: 0, confidenceLevel: "low" },
        { id: "c2", email: "jane@acme.com", emailConfidence: 90, confidenceLevel: "high" },
      ],
      sources: { apollo: true },
    };
    mockGetCached.mockResolvedValue(cachedData);

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contactId: "c1",
        email: "john@acme.com",
        emailConfidence: 85,
        confidenceLevel: "high",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.persisted).toBe(true);

    // Verify setCached was called with updated contact data
    expect(mockSetCached).toHaveBeenCalledWith(
      expect.stringContaining("enriched:contacts:acme.com"),
      expect.objectContaining({
        contacts: expect.arrayContaining([
          expect.objectContaining({
            id: "c1",
            email: "john@acme.com",
            emailConfidence: 85,
            confidenceLevel: "high",
          }),
        ]),
      }),
      120 // CacheTTL.enrichedContacts
    );
  });

  it("uses default confidence of 70 and medium level when not provided", async () => {
    const cachedData = {
      contacts: [{ id: "c1", email: null }],
      sources: {},
    };
    mockGetCached.mockResolvedValue(cachedData);

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contactId: "c1",
        email: "john@acme.com",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.persisted).toBe(true);

    expect(mockSetCached).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        contacts: [
          expect.objectContaining({
            email: "john@acme.com",
            emailConfidence: 70,
            confidenceLevel: "medium",
          }),
        ],
      }),
      120
    );
  });

  it("returns 500 with error message when an unexpected error occurs", async () => {
    mockGetCached.mockRejectedValue(new Error("Redis connection failed"));

    const res = await POST(
      makeRequest({
        domain: "acme.com",
        contactId: "c1",
        email: "john@acme.com",
      })
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Redis connection failed");
  });
});
