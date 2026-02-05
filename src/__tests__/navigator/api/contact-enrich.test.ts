import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — Apollo + Clearout providers
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/providers/apollo", () => ({
  enrichContact: vi.fn(),
  isApolloAvailable: vi.fn(),
}));

vi.mock("@/lib/navigator/providers/clearout", () => ({
  findEmail: vi.fn(),
  isClearoutAvailable: vi.fn(),
}));

import { POST } from "@/app/api/contact/enrich/route";
import {
  enrichContact,
  isApolloAvailable,
} from "@/lib/navigator/providers/apollo";
import {
  findEmail,
  isClearoutAvailable,
} from "@/lib/navigator/providers/clearout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callPOST(body: Record<string, unknown>) {
  const request = new NextRequest("http://localhost/api/contact/enrich", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return POST(request);
}

function makeEnrichedContact(overrides: Record<string, unknown> = {}) {
  return {
    id: "ct-1",
    companyDomain: "acme.com",
    companyName: "Acme Corp",
    firstName: "John",
    lastName: "Smith",
    email: "john@acme.com",
    emailConfidence: 90,
    confidenceLevel: "high",
    title: "VP of Sales",
    phone: null,
    linkedinUrl: null,
    seniority: "vp",
    lastVerified: null,
    sources: ["apollo"],
    ...overrides,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/contact/enrich", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isApolloAvailable).mockReturnValue(true);
    vi.mocked(isClearoutAvailable).mockReturnValue(false);
  });

  it("returns 400 when apolloId is missing", async () => {
    const res = await callPOST({ firstName: "John", lastName: "Smith" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/apolloId is required/i);
  });

  it("returns 503 when Apollo is not configured", async () => {
    vi.mocked(isApolloAvailable).mockReturnValue(false);

    const res = await callPOST({ apolloId: "ap-123" });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/apollo not configured/i);
    expect(data.contact).toBeNull();
  });

  it("returns enriched contact from Apollo", async () => {
    const contact = makeEnrichedContact();
    vi.mocked(enrichContact).mockResolvedValue(contact);

    const res = await callPOST({
      apolloId: "ap-123",
      firstName: "John",
      lastName: "Smith",
      domain: "acme.com",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contact).toEqual(contact);
    expect(enrichContact).toHaveBeenCalledWith("ap-123", {
      firstName: "John",
      lastName: "Smith",
      domain: "acme.com",
    });
  });

  it("returns { contact: null } when Apollo returns nothing", async () => {
    vi.mocked(enrichContact).mockResolvedValue(null);

    const res = await callPOST({ apolloId: "ap-123" });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contact).toBeNull();
    expect(data.message).toBe("No data found");
  });

  it("falls back to Clearout when contact has no email", async () => {
    const contact = makeEnrichedContact({ email: null, sources: ["apollo"] });
    vi.mocked(enrichContact).mockResolvedValue(contact);
    vi.mocked(isClearoutAvailable).mockReturnValue(true);
    vi.mocked(findEmail).mockResolvedValue({
      status: "found",
      email: "john@acme.com",
      confidence: 85,
    });

    const res = await callPOST({
      apolloId: "ap-123",
      firstName: "John",
      lastName: "Smith",
      domain: "acme.com",
    });

    expect(res.status).toBe(200);
    expect(findEmail).toHaveBeenCalledWith("John Smith", "acme.com");
  });

  it("Clearout fallback populates email and confidence", async () => {
    const contact = makeEnrichedContact({ email: null, sources: ["apollo"] });
    vi.mocked(enrichContact).mockResolvedValue(contact);
    vi.mocked(isClearoutAvailable).mockReturnValue(true);
    vi.mocked(findEmail).mockResolvedValue({
      status: "found",
      email: "john@acme.com",
      confidence: 85,
    });

    const res = await callPOST({
      apolloId: "ap-123",
      firstName: "John",
      lastName: "Smith",
      domain: "acme.com",
    });

    const data = await res.json();
    expect(data.contact.email).toBe("john@acme.com");
    expect(data.contact.emailConfidence).toBe(85);
    expect(data.contact.confidenceLevel).toBe("medium");
  });

  it("Clearout fallback adds 'clearout' to sources", async () => {
    const contact = makeEnrichedContact({ email: null, sources: ["apollo"] });
    vi.mocked(enrichContact).mockResolvedValue(contact);
    vi.mocked(isClearoutAvailable).mockReturnValue(true);
    vi.mocked(findEmail).mockResolvedValue({
      status: "found",
      email: "john@acme.com",
      confidence: 92,
    });

    const res = await callPOST({
      apolloId: "ap-123",
      firstName: "John",
      lastName: "Smith",
      domain: "acme.com",
    });

    const data = await res.json();
    expect(data.contact.sources).toContain("clearout");
    expect(data.contact.sources).toContain("apollo");
  });

  it("does NOT call Clearout when contact already has email", async () => {
    const contact = makeEnrichedContact({
      email: "existing@acme.com",
      sources: ["apollo"],
    });
    vi.mocked(enrichContact).mockResolvedValue(contact);
    vi.mocked(isClearoutAvailable).mockReturnValue(true);

    const res = await callPOST({
      apolloId: "ap-123",
      firstName: "John",
      lastName: "Smith",
      domain: "acme.com",
    });

    expect(res.status).toBe(200);
    expect(findEmail).not.toHaveBeenCalled();
  });

  it("Clearout failure does not fail the request", async () => {
    const contact = makeEnrichedContact({ email: null, sources: ["apollo"] });
    vi.mocked(enrichContact).mockResolvedValue(contact);
    vi.mocked(isClearoutAvailable).mockReturnValue(true);
    vi.mocked(findEmail).mockRejectedValue(new Error("Clearout API down"));

    const res = await callPOST({
      apolloId: "ap-123",
      firstName: "John",
      lastName: "Smith",
      domain: "acme.com",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    // Contact still returned (without Clearout email)
    expect(data.contact).toBeDefined();
    expect(data.contact.email).toBeNull();
  });

  it("returns 500 on thrown error", async () => {
    vi.mocked(enrichContact).mockRejectedValue(
      new Error("Apollo API catastrophic failure")
    );

    const res = await callPOST({
      apolloId: "ap-123",
      firstName: "John",
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.contact).toBeNull();
  });
});
