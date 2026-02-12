import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Contact, CompanyEnriched } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query
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
// Mock store
// ---------------------------------------------------------------------------

const mockCompanyContacts = vi.fn().mockReturnValue([]);
const mockSelectedCompany = vi.fn().mockReturnValue(null);
const mockAddToast = vi.fn();
const mockUpdateContact = vi.fn();

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({}));
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState: Record<string, unknown> = {
      companyContacts: mockCompanyContacts,
      selectedCompany: mockSelectedCompany,
      addToast: mockAddToast,
      updateContact: mockUpdateContact,
      adminConfig: { freshsalesSettings: {} },
    };
    return selector(mockState);
  };
  useStore.getState = store.getState;
  useStore.setState = store.setState;
  useStore.subscribe = store.subscribe;
  return { useStore };
});

// ---------------------------------------------------------------------------
// Mock child dependencies
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/outreach/useOutreachSuggestion", () => ({
  useOutreachSuggestion: () => null,
}));

vi.mock("@/components/navigator/outreach/OutreachDraftModal", () => ({
  OutreachDraftModal: () => null,
}));

vi.mock("@/hooks/navigator/useExport", () => ({
  useExport: () => ({ executeExport: vi.fn() }),
}));

vi.mock("@/lib/navigator/ui-copy", () => ({
  pick: (key: string) => key === "empty_dossier_contacts" ? "No contacts yet" : key,
}));

vi.mock("@/hooks/navigator/useInlineFeedback", () => ({
  useInlineFeedback: () => ({
    trigger: vi.fn(),
    FeedbackLabel: null,
  }),
}));

vi.mock("@/components/navigator/contacts/ContactRow", () => ({
  ContactRow: ({ contact }: { contact: Contact }) => (
    <div data-testid={`contact-row-${contact.id}`}>
      <span>{contact.firstName} {contact.lastName}</span>
      <span data-testid={`sources-${contact.id}`}>{contact.sources.join(",")}</span>
    </div>
  ),
}));

vi.mock("@/lib/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "ct-1",
    companyDomain: "acme.com",
    companyName: "Acme Corp",
    firstName: "Jane",
    lastName: "Doe",
    title: "VP of Sales",
    email: "jane@acme.com",
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

async function importDossierContacts() {
  const mod = await import("@/components/navigator/dossier/DossierContacts");
  return mod.DossierContacts;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testContacts: Contact[] = [
  makeContact({ id: "c1", firstName: "Alice", lastName: "New", sources: ["apollo"], email: "alice@acme.com" }),
  makeContact({ id: "c2", firstName: "Bob", lastName: "CRM", sources: ["apollo", "freshsales"], email: "bob@acme.com" }),
  makeContact({ id: "c3", firstName: "Carol", lastName: "New", sources: ["exa"], email: null }),
  makeContact({ id: "c4", firstName: "Dave", lastName: "CRM", sources: ["freshsales"], email: "dave@acme.com" }),
  makeContact({ id: "c5", firstName: "Eve", lastName: "New", sources: ["apollo"], email: "eve@acme.com" }),
];

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ exports: [] }),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Helper to find the source filter button (not the "All" checkbox label)
function getSourceFilterButton(): HTMLElement {
  // The source filter button is a <button> containing "All", "Freshsales", or "New only"
  // It's inside the filter bar div (mb-2 flex items-center gap-1.5)
  // Distinguish from the "All" <span> in the checkbox label by targeting buttons only.
  const buttons = screen.getAllByRole("button");
  const sourceBtn = buttons.find((btn) =>
    ["All", "Freshsales", "New only"].includes(btn.textContent?.trim() ?? "")
  );
  if (!sourceBtn) throw new Error("Source filter button not found");
  return sourceBtn;
}

describe("DossierContacts — Source filter & email-only filter", () => {
  it("source filter button cycles: All -> Freshsales -> New only -> All", async () => {
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={testContacts} />);

    const filterBtn = getSourceFilterButton();
    expect(filterBtn.textContent?.trim()).toBe("All");

    // First click: All -> Freshsales
    fireEvent.click(filterBtn);
    expect(getSourceFilterButton().textContent?.trim()).toBe("Freshsales");

    // Second click: Freshsales -> New only
    fireEvent.click(getSourceFilterButton());
    expect(getSourceFilterButton().textContent?.trim()).toBe("New only");

    // Third click: New only -> All
    fireEvent.click(getSourceFilterButton());
    expect(getSourceFilterButton().textContent?.trim()).toBe("All");
  });

  it("freshsales filter only shows contacts with sources including freshsales", async () => {
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={testContacts} />);

    // Click to switch to "Freshsales" filter
    fireEvent.click(getSourceFilterButton());

    // Only c2 and c4 have freshsales source
    expect(screen.getByTestId("contact-row-c2")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c4")).toBeInTheDocument();

    expect(screen.queryByTestId("contact-row-c1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c5")).not.toBeInTheDocument();
  });

  it("'new' filter only shows contacts WITHOUT freshsales source", async () => {
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={testContacts} />);

    // Turn off email-only (ON by default) so we can test source filter in isolation
    fireEvent.click(screen.getByText("Has email"));

    // Click twice: All -> Freshsales -> New only
    fireEvent.click(getSourceFilterButton());
    fireEvent.click(getSourceFilterButton());

    // c1, c3, c5 are "new" (no freshsales source)
    expect(screen.getByTestId("contact-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c3")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c5")).toBeInTheDocument();

    expect(screen.queryByTestId("contact-row-c2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c4")).not.toBeInTheDocument();
  });

  it("email-only filter is ON by default, removes contacts without email", async () => {
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={testContacts} />);

    // dossierEmailOnly defaults to true — c3 has no email and should be filtered out
    expect(screen.queryByTestId("contact-row-c3")).not.toBeInTheDocument();
    // Others with email remain
    expect(screen.getByTestId("contact-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c2")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c4")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c5")).toBeInTheDocument();

    // Clicking "Has email" toggles it OFF — c3 should now appear
    fireEvent.click(screen.getByText("Has email"));
    expect(screen.getByTestId("contact-row-c3")).toBeInTheDocument();
  });

  it("combined source + email filter narrows results correctly", async () => {
    // Add a freshsales contact without email
    const contactsWithMissingEmail = [
      ...testContacts,
      makeContact({ id: "c6", firstName: "Fay", lastName: "NoEmail", sources: ["freshsales"], email: null }),
    ];
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={contactsWithMissingEmail} />);

    // Switch to Freshsales filter (email-only already ON by default)
    fireEvent.click(getSourceFilterButton());

    // Freshsales: c2, c4, c6. With email (default ON): c2, c4. c6 has no email.
    expect(screen.getByTestId("contact-row-c2")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c4")).toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c6")).not.toBeInTheDocument();
  });

  it("when filter active: flat list rendered (no section headers)", async () => {
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={testContacts} />);

    // Activate freshsales filter
    fireEvent.click(getSourceFilterButton());

    // Should NOT show section headers when filter is active
    expect(screen.queryByText(/New Contacts/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Known in Freshsales/)).not.toBeInTheDocument();
  });

  it("when no filter: shows split sections (New Contacts / Known in Freshsales)", async () => {
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={testContacts} />);

    // Turn off email-only filter (ON by default) to see unfiltered sections
    fireEvent.click(screen.getByText("Has email"));

    // Now "All" with no email filter — should show sections
    // New contacts: c1, c3, c5 (no freshsales)
    expect(screen.getByText(/New Contacts \(3\)/)).toBeInTheDocument();
    // Known in Freshsales: c2, c4
    expect(screen.getByText(/Known in Freshsales \(2\)/)).toBeInTheDocument();
  });

  it("filter count shows 'X/Y' when filter is active", async () => {
    const DossierContacts = await importDossierContacts();
    render(<DossierContacts companyDomain="acme.com" contacts={testContacts} />);

    // Activate freshsales filter (2 of 5)
    fireEvent.click(getSourceFilterButton());

    expect(screen.getByText("2/5")).toBeInTheDocument();
  });
});
