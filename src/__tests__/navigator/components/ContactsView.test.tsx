import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import type { Contact } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query (ContactCard uses useQueryClient)
// ---------------------------------------------------------------------------

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, error: null }),
    useQueryClient: () => ({
      setQueriesData: vi.fn(),
      invalidateQueries: vi.fn(),
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock hooks used by ContactCard (child of InlineContacts)
// ---------------------------------------------------------------------------

vi.mock("@/hooks/navigator/useInlineFeedback", () => ({
  useInlineFeedback: () => ({
    trigger: vi.fn(),
    FeedbackLabel: null,
  }),
}));

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    contactsByDomain: {} as Record<string, Contact[]>,
    selectedContactIds: new Set<string>(),
    toggleContactSelection: vi.fn(),
    setContactsForDomain: vi.fn(),
    // Fields accessed by ContactCard child
    userName: "Adi",
    lastSearchQuery: "",
    searchSimilar: vi.fn(),
    setExpandedContactsDomain: vi.fn(),
    setCompanyStatus: vi.fn(),
    adminConfig: { freshsalesSettings: {}, pipelineStages: [] },
    addToast: vi.fn(),
    excludeContact: vi.fn(),
  }));
  return { useStore: store };
});

import { useStore } from "@/lib/navigator/store";

// Lazy import to ensure mocks are in place
async function importInlineContacts() {
  const mod = await import("@/components/navigator/cards/InlineContacts");
  return mod.InlineContacts;
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

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ contacts: [] }),
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  useStore.setState({ contactsByDomain: {}, selectedContactIds: new Set() });
});

// ---------------------------------------------------------------------------
// InlineContacts Tests (replaces deprecated ContactsView tests)
// ---------------------------------------------------------------------------

describe("InlineContacts", () => {
  it("shows shimmer loading state when contacts are not yet cached", async () => {
    // Contacts not in store, fetch will resolve eventually
    useStore.setState({ contactsByDomain: {} });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="test.com" />);

    // Should show shimmer skeleton (3 placeholder cards)
    const shimmers = document.querySelectorAll(".shimmer");
    expect(shimmers.length).toBeGreaterThanOrEqual(3);
  });

  it("shows 'No contacts found' when store has empty array for domain", async () => {
    useStore.setState({ contactsByDomain: { "test.com": [] } });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="test.com" />);

    expect(screen.getByText(/No contacts found/)).toBeInTheDocument();
  });

  it("renders contacts from store without fetching when already cached", async () => {
    const contacts = [
      makeContact({ id: "c1", firstName: "Jane", lastName: "Doe" }),
      makeContact({ id: "c2", firstName: "John", lastName: "Smith", seniority: "director", emailConfidence: 90 }),
    ];
    useStore.setState({ contactsByDomain: { "test.com": contacts } });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="test.com" />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    // Should NOT have called fetch since contacts were in store
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("fetches contacts from API when not in store", async () => {
    const apiContacts = [
      makeContact({ id: "c1", firstName: "Alice", lastName: "Wong" }),
    ];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contacts: apiContacts }),
    } as Response);

    useStore.setState({ contactsByDomain: {} });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="newco.com" companyName="NewCo" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/company/newco.com/contacts?name=NewCo")
      );
    });

    expect(useStore.getState().setContactsForDomain).toHaveBeenCalledWith("newco.com", apiContacts);
  });

  it("shows error message when fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    useStore.setState({ contactsByDomain: {} });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="fail.com" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load contacts/)).toBeInTheDocument();
    });
  });

  it("sorts contacts by seniority then email confidence", async () => {
    const contacts = [
      makeContact({ id: "c1", firstName: "Staff", lastName: "Person", seniority: "staff", emailConfidence: 90 }),
      makeContact({ id: "c2", firstName: "VP", lastName: "Person", seniority: "vp", emailConfidence: 80 }),
      makeContact({ id: "c3", firstName: "CLevel", lastName: "Person", seniority: "c_level", emailConfidence: 70 }),
    ];
    useStore.setState({ contactsByDomain: { "test.com": contacts } });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="test.com" />);

    const names = screen.getAllByText(/Person/).map((el) => el.textContent);
    // c_level first, then vp, then staff
    expect(names[0]).toContain("CLevel");
    expect(names[1]).toContain("VP");
    expect(names[2]).toContain("Staff");
  });

  it("shows only first 5 contacts with 'Show all' button when more than 5", async () => {
    const contacts = Array.from({ length: 8 }, (_, i) =>
      makeContact({ id: `c${i}`, firstName: `Person${i}`, lastName: "Test", seniority: "staff" })
    );
    useStore.setState({ contactsByDomain: { "test.com": contacts } });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="test.com" />);

    // Should show "Show all 8 contacts" button
    expect(screen.getByText("Show all 8 contacts")).toBeInTheDocument();
    // First 5 visible, last 3 not
    expect(screen.getByText("Person0 Test")).toBeInTheDocument();
    expect(screen.getByText("Person4 Test")).toBeInTheDocument();
    expect(screen.queryByText("Person5 Test")).not.toBeInTheDocument();
  });

  it("expands to show all contacts when 'Show all' is clicked", async () => {
    const contacts = Array.from({ length: 8 }, (_, i) =>
      makeContact({ id: `c${i}`, firstName: `Person${i}`, lastName: "Test", seniority: "staff" })
    );
    useStore.setState({ contactsByDomain: { "test.com": contacts } });

    const InlineContacts = await importInlineContacts();
    render(<InlineContacts domain="test.com" />);

    fireEvent.click(screen.getByText("Show all 8 contacts"));

    expect(screen.getByText("Person7 Test")).toBeInTheDocument();
    expect(screen.getByText("Show fewer")).toBeInTheDocument();
  });
});
