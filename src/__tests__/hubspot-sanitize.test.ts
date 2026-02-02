import { describe, it, expect } from "vitest";
import { sanitizeContacts } from "@/lib/providers/hubspot";
import type { Contact } from "@/lib/types";

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "hubspot-1",
    companyDomain: "example.com",
    companyName: "Example Inc",
    firstName: "Jane",
    lastName: "Doe",
    title: "VP Sales",
    email: "jane@example.com",
    phone: null,
    linkedinUrl: null,
    emailConfidence: 80,
    confidenceLevel: "medium",
    sources: ["hubspot"],
    seniority: "vp",
    lastVerified: null,
    ...overrides,
  };
}

describe("sanitizeContacts", () => {
  // -----------------------------------------------------------------------
  // Own-domain exclusion
  // -----------------------------------------------------------------------

  it("excludes contacts whose email matches the queried domain", () => {
    const contacts = [
      makeContact({ id: "1", email: "alice@mordorintelligence.com" }),
      makeContact({ id: "2", email: "bob@mordorintelligence.com" }),
    ];
    const result = sanitizeContacts(contacts, "mordorintelligence.com");
    expect(result).toHaveLength(0);
  });

  it("keeps contacts whose email does NOT match the queried domain", () => {
    const contacts = [
      makeContact({ id: "1", email: "alice@otherdomain.com" }),
      makeContact({ id: "2", email: "bob@mordorintelligence.com" }),
    ];
    const result = sanitizeContacts(contacts, "mordorintelligence.com");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("domain matching is case-insensitive", () => {
    const contacts = [
      makeContact({ email: "alice@MordorIntelligence.COM" }),
    ];
    const result = sanitizeContacts(contacts, "mordorintelligence.com");
    expect(result).toHaveLength(0);
  });

  it("keeps contacts with null email (no domain to match)", () => {
    const contacts = [makeContact({ email: null })];
    const result = sanitizeContacts(contacts, "example.com");
    expect(result).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Name cleaning — salutations
  // -----------------------------------------------------------------------

  it("clears firstName if it is 'Sir/Madam'", () => {
    const contacts = [makeContact({ firstName: "Sir/Madam", email: "x@other.com" })];
    const result = sanitizeContacts(contacts, "example.com");
    expect(result[0].firstName).toBe("");
  });

  it("clears firstName for various salutation forms", () => {
    const salutations = ["Mr", "Mrs", "Ms", "Miss", "Dr", "sir", "madam", "Sir / Madam"];
    for (const sal of salutations) {
      const contacts = [makeContact({ firstName: sal, email: "x@other.com" })];
      const result = sanitizeContacts(contacts, "example.com");
      expect(result[0].firstName).toBe("");
    }
  });

  it("does NOT clear normal first names", () => {
    const contacts = [makeContact({ firstName: "Sriharsha", email: "x@other.com" })];
    const result = sanitizeContacts(contacts, "example.com");
    expect(result[0].firstName).toBe("Sriharsha");
  });

  // -----------------------------------------------------------------------
  // Name cleaning — email-as-lastName
  // -----------------------------------------------------------------------

  it("clears lastName if it contains @", () => {
    const contacts = [
      makeContact({ lastName: "jane@example.com", email: "jane@other.com" }),
    ];
    const result = sanitizeContacts(contacts, "example.com");
    expect(result[0].lastName).toBe("");
  });

  // -----------------------------------------------------------------------
  // Name cleaning — firstName === lastName
  // -----------------------------------------------------------------------

  it("clears lastName if it equals firstName (case-insensitive)", () => {
    const contacts = [
      makeContact({ firstName: "Dominik", lastName: "Dominik", email: "d@other.com" }),
    ];
    const result = sanitizeContacts(contacts, "example.com");
    expect(result[0].firstName).toBe("Dominik");
    expect(result[0].lastName).toBe("");
  });

  it("does NOT clear lastName if it differs from firstName", () => {
    const contacts = [
      makeContact({ firstName: "Dominik", lastName: "Müller", email: "d@other.com" }),
    ];
    const result = sanitizeContacts(contacts, "example.com");
    expect(result[0].lastName).toBe("Müller");
  });

  // -----------------------------------------------------------------------
  // Whitespace trimming
  // -----------------------------------------------------------------------

  it("trims whitespace from first and last names", () => {
    const contacts = [
      makeContact({ firstName: "  Jane  ", lastName: "  Doe  ", email: "j@other.com" }),
    ];
    const result = sanitizeContacts(contacts, "example.com");
    expect(result[0].firstName).toBe("Jane");
    expect(result[0].lastName).toBe("Doe");
  });

  // -----------------------------------------------------------------------
  // Combined scenarios
  // -----------------------------------------------------------------------

  it("applies all rules together on a mixed batch", () => {
    const contacts = [
      makeContact({ id: "own", email: "team@myco.com" }),
      makeContact({ id: "salutation", firstName: "Sir/Madam", lastName: "Smith", email: "a@other.com" }),
      makeContact({ id: "email-last", firstName: "Bob", lastName: "bob@foo.com", email: "b@other.com" }),
      makeContact({ id: "dupe-name", firstName: "Alex", lastName: "Alex", email: "c@other.com" }),
      makeContact({ id: "clean", firstName: "Valid", lastName: "Contact", email: "d@other.com" }),
    ];

    const result = sanitizeContacts(contacts, "myco.com");

    // "own" excluded by domain match
    expect(result.find((c) => c.id === "own")).toBeUndefined();

    // salutation firstName cleared
    const sal = result.find((c) => c.id === "salutation")!;
    expect(sal.firstName).toBe("");
    expect(sal.lastName).toBe("Smith");

    // email-as-lastName cleared
    const emailLast = result.find((c) => c.id === "email-last")!;
    expect(emailLast.lastName).toBe("");

    // duplicate name — lastName cleared
    const dupe = result.find((c) => c.id === "dupe-name")!;
    expect(dupe.firstName).toBe("Alex");
    expect(dupe.lastName).toBe("");

    // clean contact untouched
    const clean = result.find((c) => c.id === "clean")!;
    expect(clean.firstName).toBe("Valid");
    expect(clean.lastName).toBe("Contact");
  });
});
