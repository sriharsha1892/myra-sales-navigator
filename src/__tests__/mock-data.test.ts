import { describe, it, expect } from "vitest";
import {
  confidenceLevel,
  mockCompaniesEnriched,
  mockContactsCache,
} from "@/lib/mock-data";

describe("confidenceLevel", () => {
  it("90 → high", () => {
    expect(confidenceLevel(90)).toBe("high");
  });

  it("100 → high", () => {
    expect(confidenceLevel(100)).toBe("high");
  });

  it("89 → medium", () => {
    expect(confidenceLevel(89)).toBe("medium");
  });

  it("70 → medium", () => {
    expect(confidenceLevel(70)).toBe("medium");
  });

  it("69 → low", () => {
    expect(confidenceLevel(69)).toBe("low");
  });

  it("50 → low", () => {
    expect(confidenceLevel(50)).toBe("low");
  });

  it("49 → none", () => {
    expect(confidenceLevel(49)).toBe("none");
  });

  it("0 → none", () => {
    expect(confidenceLevel(0)).toBe("none");
  });
});

describe("mock data integrity", () => {
  it("all companies have required fields", () => {
    for (const company of mockCompaniesEnriched) {
      expect(company.domain).toBeTruthy();
      expect(company.name).toBeTruthy();
      expect(typeof company.icpScore).toBe("number");
      expect(typeof company.employeeCount).toBe("number");
      expect(company.sources).toBeDefined();
      expect(Array.isArray(company.signals)).toBe(true);
      expect(company.hubspotStatus).toBeDefined();
      expect(company.lastRefreshed).toBeTruthy();
    }
  });

  it("all contacts reference valid company domains", () => {
    const companyDomains = new Set(mockCompaniesEnriched.map((c) => c.domain));
    for (const [domain, contacts] of Object.entries(mockContactsCache)) {
      expect(companyDomains.has(domain)).toBe(true);
      for (const contact of contacts) {
        expect(contact.companyDomain).toBe(domain);
        expect(contact.firstName).toBeTruthy();
        expect(contact.lastName).toBeTruthy();
        expect(typeof contact.emailConfidence).toBe("number");
      }
    }
  });
});
