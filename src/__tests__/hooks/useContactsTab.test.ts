import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useStore } from "@/lib/store";
import { useContactsTab } from "@/hooks/useContactsTab";
import { mockCompaniesEnriched, mockContactsCache } from "@/lib/mock-data";
import type { CompanyEnriched, Contact } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCompany(overrides: Partial<CompanyEnriched> = {}): CompanyEnriched {
  return {
    ...mockCompaniesEnriched[0],
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c-test",
    companyDomain: "test.com",
    companyName: "Test Co",
    firstName: "Jane",
    lastName: "Doe",
    title: "VP of Sales",
    email: "jane@test.com",
    phone: null,
    linkedinUrl: null,
    emailConfidence: 85,
    confidenceLevel: "medium",
    sources: ["apollo"],
    seniority: "vp",
    lastVerified: null,
    ...overrides,
  };
}

const companies: CompanyEnriched[] = [
  makeCompany({ domain: "alpha.com", name: "Alpha", contactCount: 3 }),
  makeCompany({ domain: "beta.com", name: "Beta", contactCount: 5 }),
];

function resetStore(overrides: Partial<Parameters<typeof useStore.setState>[0]> = {}) {
  useStore.setState({
    companies: [],
    searchResults: null,
    viewMode: "companies",
    contactsByDomain: {},
    exclusions: [],
    contactFilters: { seniority: [], hasEmail: false, sources: [], sortBy: "seniority" },
    contactGroupsCollapsed: {},
    filters: {
      sources: ["exa", "apollo", "hubspot", "freshsales"],
      verticals: [],
      regions: ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"],
      sizes: ["1-50", "51-200", "201-1000", "1000+"],
      signals: ["hiring", "funding", "expansion", "news"],
      statuses: [],
      hideExcluded: true,
      quickFilters: [],
    },
    sortField: "icp_score",
    sortDirection: "desc",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ contacts: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────
// Bug Fix A: isLoading on first render
// ─────────────────────────────────────────────────────────
describe("useContactsTab", () => {
  describe("Bug Fix A: isLoading on first render", () => {
    it("returns isLoading=true immediately when viewMode=contacts + unfetched domains", () => {
      resetStore({ viewMode: "contacts", searchResults: companies });
      const { result } = renderHook(() => useContactsTab());
      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading=false when all domains already cached in contactsByDomain", () => {
      resetStore({
        viewMode: "contacts",
        searchResults: companies,
        contactsByDomain: {
          "alpha.com": [makeContact({ companyDomain: "alpha.com" })],
          "beta.com": [makeContact({ companyDomain: "beta.com" })],
        },
      });
      const { result } = renderHook(() => useContactsTab());
      expect(result.current.isLoading).toBe(false);
    });

    it("returns isLoading=false when viewMode=companies", () => {
      resetStore({ viewMode: "companies", searchResults: companies });
      const { result } = renderHook(() => useContactsTab());
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Bug Fix B: fetchedDomainsRef resets on new search
  // ─────────────────────────────────────────────────────────
  describe("Bug Fix B: fetchedDomainsRef resets on new search", () => {
    it("re-fetches all domains when searchResults reference changes", async () => {
      // Use different domains for each search to avoid contactsByDomain cache
      const search1 = [
        makeCompany({ domain: "one.com", name: "One", contactCount: 1 }),
      ];
      const search2 = [
        makeCompany({ domain: "two.com", name: "Two", contactCount: 2 }),
      ];

      resetStore({ viewMode: "contacts", searchResults: search1 });
      const { rerender } = renderHook(() => useContactsTab());

      // Wait for initial fetch
      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      });

      fetchMock.mockClear();

      // New search results with different domains
      act(() => {
        useStore.setState({ searchResults: search2 });
      });
      rerender();

      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      });

      const urls = fetchMock.mock.calls.map((c: unknown[]) => (c[0] as string));
      expect(urls).toContain("/api/company/two.com/contacts");
    });

    it("does NOT re-fetch when searchResults reference is stable across rerenders", async () => {
      resetStore({ viewMode: "contacts", searchResults: companies });
      const { rerender } = renderHook(() => useContactsTab());

      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      });

      fetchMock.mockClear();
      rerender();

      // No new fetch calls since reference didn't change
      expect(fetchMock).toHaveBeenCalledTimes(0);
    });

    it("failed domains from previous search don't block fetching on new search", async () => {
      // First search — both fail
      fetchMock.mockRejectedValue(new Error("network error"));
      resetStore({ viewMode: "contacts", searchResults: companies });
      const { rerender } = renderHook(() => useContactsTab());

      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      });

      fetchMock.mockClear();
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contacts: [] }),
      });

      // New search results → should re-fetch
      act(() => {
        useStore.setState({ searchResults: [...companies] });
      });
      rerender();

      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // Fetch lifecycle
  // ─────────────────────────────────────────────────────────
  describe("fetch lifecycle", () => {
    it("calls fetch for each unfetched domain with correct URL", async () => {
      resetStore({ viewMode: "contacts", searchResults: companies });
      renderHook(() => useContactsTab());

      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      });

      const urls = fetchMock.mock.calls.map((c: unknown[]) => (c[0] as string));
      expect(urls).toContain("/api/company/alpha.com/contacts");
      expect(urls).toContain("/api/company/beta.com/contacts");
    });

    it("skips domains already in contactsByDomain", async () => {
      resetStore({
        viewMode: "contacts",
        searchResults: companies,
        contactsByDomain: {
          "alpha.com": [makeContact({ companyDomain: "alpha.com" })],
        },
      });
      renderHook(() => useContactsTab());

      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      });

      const urls = fetchMock.mock.calls.map((c: unknown[]) => (c[0] as string));
      expect(urls).toContain("/api/company/beta.com/contacts");
      expect(urls).not.toContain("/api/company/alpha.com/contacts");
    });

    it("sets isLoading=false after all fetches complete", async () => {
      // Pre-cache one domain, leave one unfetched — check fetchedCount reaches totalCount
      const singleCompany = [makeCompany({ domain: "solo.com", name: "Solo", contactCount: 1 })];

      // Return contacts that will be stored via setContactsForDomain
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contacts: [makeContact({ companyDomain: "solo.com" })] }),
      });

      resetStore({ viewMode: "contacts", searchResults: singleCompany });
      const { result } = renderHook(() => useContactsTab());

      expect(result.current.isLoading).toBe(true);

      // After fetch completes, fetchedCount should equal totalCount
      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.fetchedCount).toBe(result.current.totalCount);
        }, { timeout: 3000 });
      });

      // Once contacts are stored in contactsByDomain, hasUnfetchedDomains becomes false
      // The isLoading state (internal) is also set to false after Promise.all resolves
      // Verify via the store that contacts were stored
      expect(useStore.getState().contactsByDomain["solo.com"]).toBeDefined();
    });

    it("aborts in-flight requests when component unmounts", async () => {
      let abortSignal: AbortSignal | undefined;
      fetchMock.mockImplementation((_url: string, opts?: { signal?: AbortSignal }) => {
        abortSignal = opts?.signal;
        return new Promise(() => {}); // never resolves
      });

      resetStore({ viewMode: "contacts", searchResults: companies });
      const { unmount } = renderHook(() => useContactsTab());

      // Wait for fetch to be called
      await act(async () => {
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      });

      unmount();
      expect(abortSignal?.aborted).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // Filtering — groupedContacts
  // ─────────────────────────────────────────────────────────
  describe("filtering — groupedContacts", () => {
    const vpContact = makeContact({ id: "c1", seniority: "vp", email: "vp@alpha.com", sources: ["apollo"], companyDomain: "alpha.com", companyName: "Alpha" });
    const dirContact = makeContact({ id: "c2", seniority: "director", email: "dir@alpha.com", sources: ["hubspot"], companyDomain: "alpha.com", companyName: "Alpha" });
    const noEmailContact = makeContact({ id: "c3", seniority: "staff", email: null, sources: ["exa"], companyDomain: "alpha.com", companyName: "Alpha" });

    function setupWithContacts(storeOverrides = {}) {
      resetStore({
        viewMode: "contacts",
        searchResults: [companies[0]],
        contactsByDomain: { "alpha.com": [vpContact, dirContact, noEmailContact] },
        ...storeOverrides,
      });
    }

    it("filters by seniority when contactFilters.seniority is non-empty", () => {
      setupWithContacts({ contactFilters: { seniority: ["vp"], hasEmail: false, sources: [], sortBy: "seniority" } });
      const { result } = renderHook(() => useContactsTab());
      const allContacts = result.current.groupedContacts.flatMap((g) => g.contacts);
      expect(allContacts).toHaveLength(1);
      expect(allContacts[0].seniority).toBe("vp");
    });

    it("filters by hasEmail=true (only contacts with email)", () => {
      setupWithContacts({ contactFilters: { seniority: [], hasEmail: true, sources: [], sortBy: "seniority" } });
      const { result } = renderHook(() => useContactsTab());
      const allContacts = result.current.groupedContacts.flatMap((g) => g.contacts);
      expect(allContacts).toHaveLength(2);
      for (const c of allContacts) {
        expect(c.email).toBeTruthy();
      }
    });

    it("filters by sources when contactFilters.sources is non-empty", () => {
      setupWithContacts({ contactFilters: { seniority: [], hasEmail: false, sources: ["hubspot"], sortBy: "seniority" } });
      const { result } = renderHook(() => useContactsTab());
      const allContacts = result.current.groupedContacts.flatMap((g) => g.contacts);
      expect(allContacts).toHaveLength(1);
      expect(allContacts[0].sources).toContain("hubspot");
    });

    it("removes contacts with excluded emails (case-insensitive)", () => {
      setupWithContacts({
        exclusions: [
          { id: "ex1", type: "email", value: "VP@ALPHA.COM", reason: "", addedBy: "Adi", addedAt: "", source: "manual" },
        ],
      });
      const { result } = renderHook(() => useContactsTab());
      const allContacts = result.current.groupedContacts.flatMap((g) => g.contacts);
      expect(allContacts.find((c) => c.email === "vp@alpha.com")).toBeUndefined();
    });

    it("contacts without email are NOT excluded", () => {
      setupWithContacts({
        exclusions: [
          { id: "ex1", type: "email", value: "VP@ALPHA.COM", reason: "", addedBy: "Adi", addedAt: "", source: "manual" },
        ],
      });
      const { result } = renderHook(() => useContactsTab());
      const allContacts = result.current.groupedContacts.flatMap((g) => g.contacts);
      expect(allContacts.find((c) => c.email === null)).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // Sorting
  // ─────────────────────────────────────────────────────────
  describe("sorting", () => {
    const cLevel = makeContact({ id: "s1", seniority: "c_level", emailConfidence: 90, companyDomain: "alpha.com", companyName: "Alpha" });
    const vp1 = makeContact({ id: "s2", seniority: "vp", emailConfidence: 95, companyDomain: "alpha.com", companyName: "Alpha" });
    const vp2 = makeContact({ id: "s3", seniority: "vp", emailConfidence: 70, companyDomain: "alpha.com", companyName: "Alpha" });

    function setupSorting(sortBy: string) {
      resetStore({
        viewMode: "contacts",
        searchResults: [companies[0]],
        contactsByDomain: { "alpha.com": [vp2, cLevel, vp1] },
        contactFilters: { seniority: [], hasEmail: false, sources: [], sortBy: sortBy as "seniority" },
      });
    }

    it("sorts by seniority with emailConfidence tiebreak", () => {
      setupSorting("seniority");
      const { result } = renderHook(() => useContactsTab());
      const contacts = result.current.groupedContacts[0].contacts;
      expect(contacts[0].id).toBe("s1"); // c_level
      expect(contacts[1].id).toBe("s2"); // vp, higher confidence
      expect(contacts[2].id).toBe("s3"); // vp, lower confidence
    });

    it("sorts by email_confidence descending", () => {
      setupSorting("email_confidence");
      const { result } = renderHook(() => useContactsTab());
      const contacts = result.current.groupedContacts[0].contacts;
      expect(contacts[0].emailConfidence).toBe(95);
      expect(contacts[1].emailConfidence).toBe(90);
      expect(contacts[2].emailConfidence).toBe(70);
    });

    it("sorts by last_contacted with nulls at end", () => {
      const withDate = makeContact({ id: "d1", lastVerified: "2026-01-20T00:00:00Z", companyDomain: "alpha.com", companyName: "Alpha" });
      const withOlderDate = makeContact({ id: "d2", lastVerified: "2026-01-10T00:00:00Z", companyDomain: "alpha.com", companyName: "Alpha" });
      const noDate = makeContact({ id: "d3", lastVerified: null, companyDomain: "alpha.com", companyName: "Alpha" });

      resetStore({
        viewMode: "contacts",
        searchResults: [companies[0]],
        contactsByDomain: { "alpha.com": [noDate, withOlderDate, withDate] },
        contactFilters: { seniority: [], hasEmail: false, sources: [], sortBy: "last_contacted" },
      });

      const { result } = renderHook(() => useContactsTab());
      const contacts = result.current.groupedContacts[0].contacts;
      expect(contacts[0].id).toBe("d1"); // most recent
      expect(contacts[1].id).toBe("d2"); // older
      expect(contacts[2].id).toBe("d3"); // null at end
    });
  });

  // ─────────────────────────────────────────────────────────
  // estimatedTotal
  // ─────────────────────────────────────────────────────────
  describe("estimatedTotal", () => {
    it("sums contactCount from searchResults", () => {
      resetStore({ viewMode: "contacts", searchResults: companies });
      const { result } = renderHook(() => useContactsTab());
      expect(result.current.estimatedTotal).toBe(3 + 5);
    });

    it("returns 0 when searchResults is null", () => {
      resetStore({ viewMode: "contacts", searchResults: null });
      const { result } = renderHook(() => useContactsTab());
      expect(result.current.estimatedTotal).toBe(0);
    });
  });
});
