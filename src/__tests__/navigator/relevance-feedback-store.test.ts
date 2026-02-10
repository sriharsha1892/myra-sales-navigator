import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useStore } from "@/lib/navigator/store";
import type { CompanyEnriched } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock fetch (store fires fire-and-forget fetch calls)
// ---------------------------------------------------------------------------

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Test company fixtures
// ---------------------------------------------------------------------------

function makeCompany(overrides: Partial<CompanyEnriched> = {}): CompanyEnriched {
  return {
    id: overrides.domain ?? "acme.com",
    name: "Acme Corp",
    domain: "acme.com",
    industry: "Tech",
    vertical: "SaaS",
    region: "North America",
    employeeCount: 100,
    description: "A tech company",
    websiteUrl: "https://acme.com",
    linkedinUrl: "https://linkedin.com/company/acme",
    sources: ["exa"],
    signals: [],
    hubspotStatus: "none",
    freshsalesStatus: "none",
    icpScore: 70,
    lastRefreshedAt: new Date().toISOString(),
    excluded: false,
    status: "new",
    ...overrides,
  } as CompanyEnriched;
}

const companyA = makeCompany({ domain: "acme.com", name: "Acme Corp", id: "acme.com" });
const companyB = makeCompany({ domain: "beta.com", name: "Beta Corp", id: "beta.com" });
const companyC = makeCompany({ domain: "gamma.com", name: "Gamma Inc", id: "gamma.com" });

// ---------------------------------------------------------------------------
// Store reset helper
// ---------------------------------------------------------------------------

function resetStore() {
  useStore.setState({
    companies: [companyA, companyB, companyC],
    searchResults: null,
    relevanceFeedback: {},
    showHiddenResults: false,
    similarResults: null,
    similarLoading: false,
    userName: "TestUser",
    lastSearchQuery: null,
    filters: {
      sources: [],
      verticals: [],
      regions: [],
      sizes: [],
      signals: [],
      statuses: [],
      hideExcluded: true,
      quickFilters: [],
    },
    sortField: "icp_score",
    sortDirection: "desc",
  });
}

// ===========================================================================
// Tests
// ===========================================================================

describe("relevance feedback store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // --- setRelevanceFeedback ------------------------------------------------

  describe("setRelevanceFeedback", () => {
    it("sets feedback for a domain", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_industry");

      const fb = useStore.getState().relevanceFeedback;
      expect(fb["acme.com"]).toEqual({
        feedback: "not_relevant",
        reason: "wrong_industry",
      });
    });

    it("sets feedback without reason", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "relevant");

      const fb = useStore.getState().relevanceFeedback;
      expect(fb["acme.com"]).toEqual({
        feedback: "relevant",
        reason: undefined,
      });
    });

    it("overwrites existing feedback for same domain", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_size");
      useStore.getState().setRelevanceFeedback("acme.com", "relevant");

      const fb = useStore.getState().relevanceFeedback;
      expect(fb["acme.com"].feedback).toBe("relevant");
    });

    it("does not affect feedback for other domains", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_size");
      useStore.getState().setRelevanceFeedback("beta.com", "relevant");

      const fb = useStore.getState().relevanceFeedback;
      expect(fb["acme.com"].feedback).toBe("not_relevant");
      expect(fb["beta.com"].feedback).toBe("relevant");
    });

    it("persists to localStorage", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_industry");

      const stored = JSON.parse(localStorage.getItem("nav_relevance_feedback") ?? "{}");
      expect(stored["acme.com"]).toEqual({
        feedback: "not_relevant",
        reason: "wrong_industry",
      });
    });

    it("fires fetch POST to /api/relevance-feedback", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_industry");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/relevance-feedback",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"domain":"acme.com"'),
        })
      );
    });

    it("includes company context in fetch body when company exists in results", () => {
      useStore.setState({
        searchResults: [companyA],
        lastSearchQuery: "tech companies",
      });

      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_size");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.domain).toBe("acme.com");
      expect(callBody.feedback).toBe("not_relevant");
      expect(callBody.reason).toBe("wrong_size");
      expect(callBody.userName).toBe("TestUser");
      expect(callBody.searchQuery).toBe("tech companies");
      expect(callBody.companyIndustry).toBe("Tech");
      expect(callBody.companyRegion).toBe("North America");
    });
  });

  // --- clearRelevanceFeedback ----------------------------------------------

  describe("clearRelevanceFeedback", () => {
    it("removes feedback for the specified domain", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_industry");
      useStore.getState().setRelevanceFeedback("beta.com", "relevant");
      mockFetch.mockClear();

      useStore.getState().clearRelevanceFeedback("acme.com");

      const fb = useStore.getState().relevanceFeedback;
      expect(fb["acme.com"]).toBeUndefined();
      // beta still exists
      expect(fb["beta.com"]).toBeDefined();
    });

    it("persists removal to localStorage", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant");
      useStore.getState().clearRelevanceFeedback("acme.com");

      const stored = JSON.parse(localStorage.getItem("nav_relevance_feedback") ?? "{}");
      expect(stored["acme.com"]).toBeUndefined();
    });

    it("fires fetch DELETE to /api/relevance-feedback", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant");
      mockFetch.mockClear();

      useStore.getState().clearRelevanceFeedback("acme.com");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/relevance-feedback",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ domain: "acme.com" }),
        })
      );
    });

    it("is a no-op when domain has no feedback (no crash)", () => {
      expect(() => {
        useStore.getState().clearRelevanceFeedback("nonexistent.com");
      }).not.toThrow();
    });
  });

  // --- filteredCompanies and relevance feedback ----------------------------

  describe("filteredCompanies with relevance feedback", () => {
    it("hides not_relevant companies when showHiddenResults is false", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_industry");

      const result = useStore.getState().filteredCompanies();
      const domains = result.map((c) => c.domain);
      expect(domains).not.toContain("acme.com");
      expect(domains).toContain("beta.com");
      expect(domains).toContain("gamma.com");
    });

    it("shows not_relevant companies when showHiddenResults is true", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_industry");
      useStore.setState({ showHiddenResults: true });

      const result = useStore.getState().filteredCompanies();
      const domains = result.map((c) => c.domain);
      expect(domains).toContain("acme.com");
    });

    it("does not hide companies with 'relevant' feedback", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "relevant");

      const result = useStore.getState().filteredCompanies();
      const domains = result.map((c) => c.domain);
      expect(domains).toContain("acme.com");
    });

    it("hides multiple not_relevant companies", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_size");
      useStore.getState().setRelevanceFeedback("beta.com", "not_relevant", "wrong_region");

      const result = useStore.getState().filteredCompanies();
      const domains = result.map((c) => c.domain);
      expect(domains).not.toContain("acme.com");
      expect(domains).not.toContain("beta.com");
      expect(domains).toContain("gamma.com");
    });

    it("re-shows a company after clearing its not_relevant feedback", () => {
      useStore.getState().setRelevanceFeedback("acme.com", "not_relevant", "wrong_industry");
      // Verify hidden
      expect(
        useStore.getState().filteredCompanies().map((c) => c.domain)
      ).not.toContain("acme.com");

      mockFetch.mockClear();
      useStore.getState().clearRelevanceFeedback("acme.com");

      // Verify visible again
      expect(
        useStore.getState().filteredCompanies().map((c) => c.domain)
      ).toContain("acme.com");
    });

    it("works with searchResults as data source", () => {
      useStore.setState({ searchResults: [companyA, companyB, companyC] });
      useStore.getState().setRelevanceFeedback("beta.com", "not_relevant", "wrong_region");

      const result = useStore.getState().filteredCompanies();
      expect(result.map((c) => c.domain)).not.toContain("beta.com");
    });
  });

  // --- showHiddenResults toggle --------------------------------------------

  describe("showHiddenResults", () => {
    it("defaults to false", () => {
      expect(useStore.getState().showHiddenResults).toBe(false);
    });

    it("can be toggled on", () => {
      useStore.getState().setShowHiddenResults(true);
      expect(useStore.getState().showHiddenResults).toBe(true);
    });

    it("can be toggled back off", () => {
      useStore.getState().setShowHiddenResults(true);
      useStore.getState().setShowHiddenResults(false);
      expect(useStore.getState().showHiddenResults).toBe(false);
    });
  });

  // --- similarResults clearing on new search -------------------------------

  describe("similarResults clearing", () => {
    it("clears similarResults when setSearchResults is called", () => {
      useStore.setState({
        similarResults: {
          seedDomain: "acme.com",
          seedName: "Acme Corp",
          companies: [companyB],
        },
      });

      // Verify similar results are set
      expect(useStore.getState().similarResults).not.toBeNull();

      // New search results
      useStore.getState().setSearchResults([companyA, companyC]);

      // Similar results should be cleared
      expect(useStore.getState().similarResults).toBeNull();
    });

    it("clears similarResults even when setting null search results", () => {
      useStore.setState({
        similarResults: {
          seedDomain: "acme.com",
          seedName: "Acme Corp",
          companies: [companyB],
        },
      });

      useStore.getState().setSearchResults(null);
      expect(useStore.getState().similarResults).toBeNull();
    });
  });

  // --- similarResults state management -------------------------------------

  describe("similarResults / similarLoading", () => {
    it("setSimilarResults stores the result", () => {
      const result = {
        seedDomain: "acme.com",
        seedName: "Acme Corp",
        companies: [companyB],
      };
      useStore.getState().setSimilarResults(result);
      expect(useStore.getState().similarResults).toEqual(result);
    });

    it("setSimilarResults(null) clears results", () => {
      useStore.getState().setSimilarResults({
        seedDomain: "acme.com",
        seedName: "Acme Corp",
        companies: [companyB],
      });
      useStore.getState().setSimilarResults(null);
      expect(useStore.getState().similarResults).toBeNull();
    });

    it("setSimilarLoading updates loading state", () => {
      expect(useStore.getState().similarLoading).toBe(false);
      useStore.getState().setSimilarLoading(true);
      expect(useStore.getState().similarLoading).toBe(true);
      useStore.getState().setSimilarLoading(false);
      expect(useStore.getState().similarLoading).toBe(false);
    });
  });
});
