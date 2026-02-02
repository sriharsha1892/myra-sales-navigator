import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Contact } from "@/lib/types";

// jsdom doesn't implement scrollTo
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

const mockUseContactsTab = vi.fn();

vi.mock("@/hooks/useContactsTab", () => ({
  useContactsTab: () => mockUseContactsTab(),
}));

vi.mock("@/hooks/useSearchHistory", () => ({
  useSearchHistory: () => ({ history: [], isLoading: false }),
}));

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

vi.mock("@/lib/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    viewMode: "contacts" as const,
    searchResults: [] as unknown[],
    selectedContactIds: new Set<string>(),
    selectedCompanyDomains: new Set<string>(),
    contactGroupsCollapsed: {} as Record<string, boolean>,
    contactVisibleFields: new Set(["name", "email", "title", "seniority", "sources", "lastContacted"]),
    focusedContactId: null as string | null,
    sortField: "icp_score",
    sortDirection: "desc",
    resultGrouping: "icp_tier",
    detailPaneCollapsed: false,
    selectedCompanyDomain: null as string | null,
    searchLoading: false,
    searchError: null as string | null,
    filters: {
      sources: ["exa", "apollo", "hubspot", "freshsales"],
      verticals: [] as string[],
      regions: [] as string[],
      sizes: [] as string[],
      signals: [] as string[],
      statuses: [] as string[],
      hideExcluded: true,
      quickFilters: [] as string[],
    },
    contactFilters: { seniority: [] as string[], hasEmail: false, sources: [] as string[], sortBy: "seniority" },
    exportState: null,
    triggerExport: null,
    sessionCompaniesReviewed: 0,
    sessionContactsExported: 0,
    pendingFreeTextSearch: null,
    companies: [] as unknown[],
    contactsByDomain: {} as Record<string, unknown[]>,
    commandPaletteOpen: false,
    slideOverOpen: false,
    slideOverMode: "dossier",
    recentDomains: [] as string[],

    // Actions
    toggleContactSelection: vi.fn(),
    toggleCompanySelection: vi.fn(),
    toggleContactGroupCollapsed: vi.fn(),
    selectCompany: vi.fn(),
    setViewMode: vi.fn(),
    setContactFilters: vi.fn(),
    setContactVisibleFields: vi.fn(),
    collapseAllContactGroups: vi.fn(),
    expandAllContactGroups: vi.fn(),
    setFocusedContactId: vi.fn(),
    setResultGrouping: vi.fn(),
    filteredCompanies: () => [],
    selectedCompany: () => null,
    setTriggerExport: vi.fn(),
    deselectAllContacts: vi.fn(),
    deselectAllCompanies: vi.fn(),
    selectAllContacts: vi.fn(),
    selectAllCompanies: vi.fn(),
    setExportState: vi.fn(),
    setSortField: vi.fn(),
    setSortDirection: vi.fn(),
    setFilters: vi.fn(),
    setPendingFreeTextSearch: vi.fn(),
    setPendingFilterSearch: vi.fn(),
  }));
  return { useStore: store };
});

import { useStore } from "@/lib/store";

// Lazy import to ensure mocks are in place
async function importResultsList() {
  const mod = await import("@/components/layout/ResultsList");
  return mod.default ?? (mod as Record<string, unknown>).ResultsList;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "ct-1",
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ContactsView render branches", () => {
  it("renders skeleton cards when loading with no contacts", async () => {
    mockUseContactsTab.mockReturnValue({
      isLoading: true,
      fetchedCount: 0,
      totalCount: 5,
      estimatedTotal: 25,
      groupedContacts: [],
    });

    useStore.setState({ viewMode: "contacts", searchResults: [] });

    const ResultsList = await importResultsList();
    render(<ResultsList />);

    expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
  });

  it("renders EmptyState when done loading with no contacts", async () => {
    mockUseContactsTab.mockReturnValue({
      isLoading: false,
      fetchedCount: 5,
      totalCount: 5,
      estimatedTotal: 0,
      groupedContacts: [],
    });

    useStore.setState({ viewMode: "contacts", searchResults: [] });

    const ResultsList = await importResultsList();
    render(<ResultsList />);

    expect(screen.getByText("No contacts available")).toBeInTheDocument();
  });

  it("renders progress bar when loading with some contacts visible", async () => {
    const contacts = [
      makeContact({ id: "c1", companyDomain: "alpha.com", companyName: "Alpha" }),
    ];

    mockUseContactsTab.mockReturnValue({
      isLoading: true,
      fetchedCount: 2,
      totalCount: 5,
      estimatedTotal: 25,
      groupedContacts: [{ domain: "alpha.com", companyName: "Alpha", icpScore: 85, contacts }],
    });

    useStore.setState({ viewMode: "contacts", searchResults: [] });

    const ResultsList = await importResultsList();
    render(<ResultsList />);

    expect(screen.getByText("2/5 companies loaded")).toBeInTheDocument();
    expect(screen.getByText("~25 estimated contacts")).toBeInTheDocument();
  });

  it("renders grouped list with company headers when contacts loaded", async () => {
    const contacts1 = [makeContact({ id: "c1", companyDomain: "alpha.com", companyName: "Alpha" })];
    const contacts2 = [makeContact({ id: "c2", companyDomain: "beta.com", companyName: "Beta" })];

    mockUseContactsTab.mockReturnValue({
      isLoading: false,
      fetchedCount: 2,
      totalCount: 2,
      estimatedTotal: 2,
      groupedContacts: [
        { domain: "alpha.com", companyName: "Alpha", icpScore: 90, contacts: contacts1 },
        { domain: "beta.com", companyName: "Beta", icpScore: 80, contacts: contacts2 },
      ],
    });

    useStore.setState({ viewMode: "contacts", searchResults: [] });

    const ResultsList = await importResultsList();
    render(<ResultsList />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("collapsed groups hide their contact cards", async () => {
    const contacts = [
      makeContact({ id: "c1", companyDomain: "alpha.com", companyName: "Alpha", firstName: "Jane", lastName: "Doe" }),
    ];

    mockUseContactsTab.mockReturnValue({
      isLoading: false,
      fetchedCount: 1,
      totalCount: 1,
      estimatedTotal: 1,
      groupedContacts: [
        { domain: "alpha.com", companyName: "Alpha", icpScore: 90, contacts },
      ],
    });

    useStore.setState({
      viewMode: "contacts",
      searchResults: [],
      contactGroupsCollapsed: { "alpha.com": true },
    });

    const ResultsList = await importResultsList();
    render(<ResultsList />);

    // Company header should be visible
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    // Contact name should NOT be visible (group is collapsed)
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });
});
