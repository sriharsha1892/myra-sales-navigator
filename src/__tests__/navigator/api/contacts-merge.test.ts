import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Contact } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mocks — providers + cache
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/providers/apollo", () => ({
  findContacts: vi.fn().mockResolvedValue([]),
  isApolloAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/navigator/providers/hubspot", () => ({
  getHubSpotContacts: vi.fn().mockResolvedValue([]),
  isHubSpotAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/navigator/providers/freshsales", () => ({
  getFreshsalesContacts: vi.fn().mockResolvedValue([]),
  isFreshsalesAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cache")>();
  return {
    ...actual,
    getCached: vi.fn().mockResolvedValue(null),
    setCached: vi.fn().mockResolvedValue(undefined),
    deleteCached: vi.fn().mockResolvedValue(undefined),
  };
});

import { GET } from "@/app/api/company/[domain]/contacts/route";
import { findContacts, isApolloAvailable } from "@/lib/navigator/providers/apollo";
import { getHubSpotContacts, isHubSpotAvailable } from "@/lib/navigator/providers/hubspot";
import { getFreshsalesContacts, isFreshsalesAvailable } from "@/lib/navigator/providers/freshsales";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "ct-1",
    companyDomain: "test.com",
    companyName: "Test Co",
    firstName: "John",
    lastName: "Smith",
    title: "VP of Sales",
    email: "john@test.com",
    phone: null,
    linkedinUrl: null,
    emailConfidence: 90,
    confidenceLevel: "high",
    sources: ["apollo"],
    seniority: "vp",
    lastVerified: null,
    ...overrides,
  };
}

async function callGET(domain = "test.com") {
  const request = new Request(`http://localhost/api/company/${domain}/contacts`);
  const params = Promise.resolve({ domain });
  return GET(request, { params });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/company/[domain]/contacts", () => {
  beforeEach(() => {
    vi.mocked(isApolloAvailable).mockReturnValue(false);
    vi.mocked(isHubSpotAvailable).mockReturnValue(false);
    vi.mocked(isFreshsalesAvailable).mockReturnValue(false);
    vi.mocked(findContacts).mockResolvedValue([]);
    vi.mocked(getHubSpotContacts).mockResolvedValue([]);
    vi.mocked(getFreshsalesContacts).mockResolvedValue([]);
  });

  it("returns 503 when no sources available", async () => {
    const res = await callGET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.contacts).toEqual([]);
    expect(data.message).toMatch(/no contact data sources/i);
  });

  it("returns merged contacts from all 3 sources", async () => {
    vi.mocked(isApolloAvailable).mockReturnValue(true);
    vi.mocked(isHubSpotAvailable).mockReturnValue(true);
    vi.mocked(isFreshsalesAvailable).mockReturnValue(true);

    vi.mocked(findContacts).mockResolvedValue([
      makeContact({ id: "a1", email: "alice@test.com", firstName: "Alice", lastName: "A", sources: ["apollo"] }),
    ]);
    vi.mocked(getHubSpotContacts).mockResolvedValue([
      makeContact({ id: "h1", email: "bob@test.com", firstName: "Bob", lastName: "B", sources: ["hubspot"] }),
    ]);
    vi.mocked(getFreshsalesContacts).mockResolvedValue([
      makeContact({ id: "f1", email: "carol@test.com", firstName: "Carol", lastName: "C", sources: ["freshsales"] }),
    ]);

    const res = await callGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contacts).toHaveLength(3);
    expect(data.sources.apollo).toBe(true);
    expect(data.sources.hubspot).toBe(true);
    expect(data.sources.freshsales).toBe(true);
  });

  it("returns 500 on provider error", async () => {
    vi.mocked(isApolloAvailable).mockReturnValue(true);
    vi.mocked(findContacts).mockRejectedValue(new Error("API down"));

    const res = await callGET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────
  // mergeContacts dedup
  // ─────────────────────────────────────────────────────────
  describe("mergeContacts dedup", () => {
    it("deduplicates by email — Apollo fields take priority", async () => {
      vi.mocked(isApolloAvailable).mockReturnValue(true);
      vi.mocked(isHubSpotAvailable).mockReturnValue(true);

      vi.mocked(findContacts).mockResolvedValue([
        makeContact({ id: "a1", email: "same@test.com", title: "Apollo Title", phone: "+1-111", sources: ["apollo"] }),
      ]);
      vi.mocked(getHubSpotContacts).mockResolvedValue([
        makeContact({ id: "h1", email: "same@test.com", title: "HubSpot Title", phone: "+1-222", sources: ["hubspot"] }),
      ]);

      const res = await callGET();
      const data = await res.json();
      expect(data.contacts).toHaveLength(1);
      // Apollo title wins since it was set first
      expect(data.contacts[0].title).toBe("Apollo Title");
      // Apollo phone wins since it was set first
      expect(data.contacts[0].phone).toBe("+1-111");
    });

    it("HubSpot/Freshsales fill gaps (phone, linkedinUrl, lastVerified)", async () => {
      vi.mocked(isApolloAvailable).mockReturnValue(true);
      vi.mocked(isHubSpotAvailable).mockReturnValue(true);

      vi.mocked(findContacts).mockResolvedValue([
        makeContact({ id: "a1", email: "same@test.com", phone: null, linkedinUrl: null, lastVerified: null, sources: ["apollo"] }),
      ]);
      vi.mocked(getHubSpotContacts).mockResolvedValue([
        makeContact({ id: "h1", email: "same@test.com", phone: "+1-999", linkedinUrl: "https://linkedin.com/in/test", lastVerified: "2026-01-15", sources: ["hubspot"] }),
      ]);

      const res = await callGET();
      const data = await res.json();
      expect(data.contacts).toHaveLength(1);
      expect(data.contacts[0].phone).toBe("+1-999");
      expect(data.contacts[0].linkedinUrl).toBe("https://linkedin.com/in/test");
      expect(data.contacts[0].lastVerified).toBe("2026-01-15");
    });

    it("deduplicates by name when emails differ", async () => {
      vi.mocked(isApolloAvailable).mockReturnValue(true);
      vi.mocked(isHubSpotAvailable).mockReturnValue(true);

      vi.mocked(findContacts).mockResolvedValue([
        makeContact({ id: "a1", email: "john.apollo@test.com", firstName: "John", lastName: "Smith", sources: ["apollo"] }),
      ]);
      vi.mocked(getHubSpotContacts).mockResolvedValue([
        makeContact({ id: "h1", email: "john.hubspot@test.com", firstName: "John", lastName: "Smith", sources: ["hubspot"] }),
      ]);

      const res = await callGET();
      const data = await res.json();
      // Should merge because same name
      expect(data.contacts).toHaveLength(1);
    });

    it("name matching is case-insensitive", async () => {
      vi.mocked(isApolloAvailable).mockReturnValue(true);
      vi.mocked(isHubSpotAvailable).mockReturnValue(true);

      vi.mocked(findContacts).mockResolvedValue([
        makeContact({ id: "a1", email: "a@test.com", firstName: "JOHN", lastName: "SMITH", sources: ["apollo"] }),
      ]);
      vi.mocked(getHubSpotContacts).mockResolvedValue([
        makeContact({ id: "h1", email: "b@test.com", firstName: "john", lastName: "smith", sources: ["hubspot"] }),
      ]);

      const res = await callGET();
      const data = await res.json();
      expect(data.contacts).toHaveLength(1);
    });

    it("fieldSources tracks which source provided each field", async () => {
      vi.mocked(isApolloAvailable).mockReturnValue(true);
      vi.mocked(isHubSpotAvailable).mockReturnValue(true);

      vi.mocked(findContacts).mockResolvedValue([
        makeContact({ id: "a1", email: "same@test.com", phone: null, linkedinUrl: null, sources: ["apollo"] }),
      ]);
      vi.mocked(getHubSpotContacts).mockResolvedValue([
        makeContact({ id: "h1", email: "same@test.com", phone: "+1-999", linkedinUrl: "https://li.com/x", sources: ["hubspot"] }),
      ]);

      const res = await callGET();
      const data = await res.json();
      const contact = data.contacts[0];
      expect(contact.fieldSources.email).toBe("apollo");
      expect(contact.fieldSources.phone).toBe("hubspot");
      expect(contact.fieldSources.linkedinUrl).toBe("hubspot");
    });

    it("sources array accumulates without duplicates", async () => {
      vi.mocked(isApolloAvailable).mockReturnValue(true);
      vi.mocked(isHubSpotAvailable).mockReturnValue(true);
      vi.mocked(isFreshsalesAvailable).mockReturnValue(true);

      vi.mocked(findContacts).mockResolvedValue([
        makeContact({ id: "a1", email: "same@test.com", sources: ["apollo"] }),
      ]);
      vi.mocked(getHubSpotContacts).mockResolvedValue([
        makeContact({ id: "h1", email: "same@test.com", sources: ["hubspot"] }),
      ]);
      vi.mocked(getFreshsalesContacts).mockResolvedValue([
        makeContact({ id: "f1", email: "same@test.com", sources: ["freshsales"] }),
      ]);

      const res = await callGET();
      const data = await res.json();
      expect(data.contacts).toHaveLength(1);
      const sources = data.contacts[0].sources;
      expect(sources).toContain("apollo");
      expect(sources).toContain("hubspot");
      expect(sources).toContain("freshsales");
      // No duplicates
      expect(new Set(sources).size).toBe(sources.length);
    });

    it("new contacts from secondary sources get added with correct fieldSources", async () => {
      vi.mocked(isApolloAvailable).mockReturnValue(true);
      vi.mocked(isHubSpotAvailable).mockReturnValue(true);

      vi.mocked(findContacts).mockResolvedValue([
        makeContact({ id: "a1", email: "apollo-only@test.com", sources: ["apollo"] }),
      ]);
      vi.mocked(getHubSpotContacts).mockResolvedValue([
        makeContact({ id: "h1", email: "hubspot-only@test.com", firstName: "Hub", lastName: "Spot", phone: "+1-555", sources: ["hubspot"] }),
      ]);

      const res = await callGET();
      const data = await res.json();
      expect(data.contacts).toHaveLength(2);

      const hubContact = data.contacts.find((c: Contact) => c.email === "hubspot-only@test.com");
      expect(hubContact).toBeDefined();
      expect(hubContact.fieldSources.email).toBe("hubspot");
      expect(hubContact.fieldSources.phone).toBe("hubspot");
    });
  });
});
