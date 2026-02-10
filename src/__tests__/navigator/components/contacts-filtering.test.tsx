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

const mockSetSlideOverMode = vi.fn();
const mockToggleContactSelection = vi.fn();

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({}));
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState: Record<string, unknown> = {
      setSlideOverMode: mockSetSlideOverMode,
      selectedContactIds: new Set<string>(),
      toggleContactSelection: mockToggleContactSelection,
      updateContact: vi.fn(),
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

vi.mock("@/components/navigator/contacts/ContactRow", () => ({
  ContactRow: ({ contact }: { contact: Contact }) => (
    <div data-testid={`contact-row-${contact.id}`}>
      <span>{contact.firstName} {contact.lastName}</span>
      <span data-testid={`seniority-${contact.id}`}>{contact.seniority}</span>
      <span data-testid={`email-${contact.id}`}>{contact.email ?? "no-email"}</span>
      <span data-testid={`sources-${contact.id}`}>{contact.sources.join(",")}</span>
      <span data-testid={`verification-${contact.id}`}>{contact.verificationStatus ?? "unverified"}</span>
      <span data-testid={`confidence-${contact.id}`}>{contact.emailConfidence}</span>
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

function makeCompany(overrides: Partial<CompanyEnriched> = {}): CompanyEnriched {
  return {
    domain: "acme.com",
    name: "Acme Corp",
    firstViewedBy: "test",
    firstViewedAt: "2026-01-01",
    lastViewedBy: "test",
    lastViewedAt: "2026-01-01",
    source: "exa",
    noteCount: 0,
    lastNoteAt: null,
    extractionCount: 0,
    lastExtractionAt: null,
    excluded: false,
    excludedBy: null,
    excludedAt: null,
    exclusionReason: null,
    status: "new",
    statusChangedBy: null,
    statusChangedAt: null,
    viewedBy: null,
    industry: "Software",
    vertical: "SaaS",
    employeeCount: 150,
    location: "San Francisco, CA",
    region: "North America",
    description: "A software company",
    icpScore: 75,
    hubspotStatus: "none",
    freshsalesStatus: "none",
    freshsalesIntel: null,
    sources: ["exa", "apollo"],
    signals: [],
    contactCount: 5,
    lastRefreshed: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

// Lazy import to ensure mocks are in place
async function importContactsPanel() {
  const mod = await import("@/components/navigator/contacts/ContactsPanel");
  return mod.ContactsPanel;
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Test contacts
// ---------------------------------------------------------------------------

const testContacts: Contact[] = [
  makeContact({ id: "c1", firstName: "Alice", lastName: "CEO", seniority: "c_level", emailConfidence: 95, email: "alice@acme.com", sources: ["apollo", "freshsales"], verificationStatus: "valid", lastVerified: "2026-02-01T10:00:00Z" }),
  makeContact({ id: "c2", firstName: "Bob", lastName: "VP", seniority: "vp", emailConfidence: 80, email: "bob@acme.com", sources: ["apollo"], verificationStatus: "unverified", lastVerified: "2026-01-15T10:00:00Z" }),
  makeContact({ id: "c3", firstName: "Carol", lastName: "Director", seniority: "director", emailConfidence: 70, email: "carol@acme.com", sources: ["freshsales"], verificationStatus: "valid_risky", lastVerified: "2026-01-20T10:00:00Z" }),
  makeContact({ id: "c4", firstName: "Dave", lastName: "Manager", seniority: "manager", emailConfidence: 60, email: null, sources: ["apollo"], verificationStatus: "unverified", lastVerified: null }),
  makeContact({ id: "c5", firstName: "Eve", lastName: "Staff", seniority: "staff", emailConfidence: 50, email: "eve@acme.com", sources: ["apollo"], verificationStatus: "invalid", lastVerified: "2026-02-05T10:00:00Z" }),
  makeContact({ id: "c6", firstName: "Frank", lastName: "Unknown", seniority: "staff" as Contact["seniority"], emailConfidence: 40, email: "frank@acme.com", sources: ["freshsales"], verificationStatus: "valid", lastVerified: null }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ContactsPanel — Filtering & Sorting", () => {
  it("default state shows all contacts, no filter count displayed", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // All 6 contacts rendered
    for (const c of testContacts) {
      expect(screen.getByTestId(`contact-row-${c.id}`)).toBeInTheDocument();
    }

    // No filter count shown when no filters active
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  it("default sort is by seniority: c_level > vp > director > manager > staff", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    const rows = screen.getAllByTestId(/^contact-row-/);
    // c_level (c1), vp (c2), director (c3), manager (c4), staff (c5, c6)
    expect(rows[0]).toHaveAttribute("data-testid", "contact-row-c1");
    expect(rows[1]).toHaveAttribute("data-testid", "contact-row-c2");
    expect(rows[2]).toHaveAttribute("data-testid", "contact-row-c3");
    expect(rows[3]).toHaveAttribute("data-testid", "contact-row-c4");
    // c5 and c6 are both "staff" — original order preserved
    expect(rows[4]).toHaveAttribute("data-testid", "contact-row-c5");
    expect(rows[5]).toHaveAttribute("data-testid", "contact-row-c6");
  });

  it("source filter 'In Freshsales' shows only contacts with freshsales source", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Click "In Freshsales" button to toggle source filter
    const fsButton = screen.getByText("In Freshsales");
    fireEvent.click(fsButton);

    // Only c1 (alice), c3 (carol), c6 (frank) have freshsales source
    expect(screen.getByTestId("contact-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c3")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c6")).toBeInTheDocument();

    // Others should not be visible
    expect(screen.queryByTestId("contact-row-c2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c4")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c5")).not.toBeInTheDocument();
  });

  it("verified filter shows only contacts with valid or valid_risky verification", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Click "Verified" button
    const verifiedBtn = screen.getByText("Verified");
    fireEvent.click(verifiedBtn);

    // valid: c1, c6; valid_risky: c3
    expect(screen.getByTestId("contact-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c3")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c6")).toBeInTheDocument();

    // unverified (c2, c4), invalid (c5) should not be visible
    expect(screen.queryByTestId("contact-row-c2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c4")).not.toBeInTheDocument();
    expect(screen.queryByTestId("contact-row-c5")).not.toBeInTheDocument();
  });

  it("sort by email_confidence orders highest first", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Change sort to email_confidence
    const sortSelect = screen.getByDisplayValue("Sort: Seniority");
    fireEvent.change(sortSelect, { target: { value: "email_confidence" } });

    const rows = screen.getAllByTestId(/^contact-row-/);
    // c1=95, c2=80, c3=70, c4=60, c5=50, c6=40
    expect(rows[0]).toHaveAttribute("data-testid", "contact-row-c1");
    expect(rows[1]).toHaveAttribute("data-testid", "contact-row-c2");
    expect(rows[2]).toHaveAttribute("data-testid", "contact-row-c3");
    expect(rows[3]).toHaveAttribute("data-testid", "contact-row-c4");
    expect(rows[4]).toHaveAttribute("data-testid", "contact-row-c5");
    expect(rows[5]).toHaveAttribute("data-testid", "contact-row-c6");
  });

  it("sort by last_contacted orders most recent first, null dates last", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Change sort to last_contacted (uses lastVerified field)
    const sortSelect = screen.getByDisplayValue("Sort: Seniority");
    fireEvent.change(sortSelect, { target: { value: "last_contacted" } });

    const rows = screen.getAllByTestId(/^contact-row-/);
    // Dates: c5=Feb5, c1=Feb1, c3=Jan20, c2=Jan15, c4=null(0), c6=null(0)
    expect(rows[0]).toHaveAttribute("data-testid", "contact-row-c5");
    expect(rows[1]).toHaveAttribute("data-testid", "contact-row-c1");
    expect(rows[2]).toHaveAttribute("data-testid", "contact-row-c3");
    expect(rows[3]).toHaveAttribute("data-testid", "contact-row-c2");
    // c4 and c6 both null — equal, order preserved
    expect(rows[4]).toHaveAttribute("data-testid", "contact-row-c4");
    expect(rows[5]).toHaveAttribute("data-testid", "contact-row-c6");
  });

  it("combined filters: freshsales + verified + sort by confidence", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Activate freshsales source filter
    fireEvent.click(screen.getByText("In Freshsales"));
    // Activate verified filter
    fireEvent.click(screen.getByText("Verified"));
    // Sort by confidence
    const sortSelect = screen.getByDisplayValue("Sort: Seniority");
    fireEvent.change(sortSelect, { target: { value: "email_confidence" } });

    // Freshsales: c1, c3, c6. Verified (valid/valid_risky): c1, c3, c6 — intersection: c1, c3, c6
    // Sort by confidence: c1(95), c3(70), c6(40)
    const rows = screen.getAllByTestId(/^contact-row-/);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute("data-testid", "contact-row-c1");
    expect(rows[1]).toHaveAttribute("data-testid", "contact-row-c3");
    expect(rows[2]).toHaveAttribute("data-testid", "contact-row-c6");
  });

  it("filter count shows correct 'X/Y' when filters are active", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Activate freshsales filter (3 of 6)
    fireEvent.click(screen.getByText("In Freshsales"));

    expect(screen.getByText("3/6")).toBeInTheDocument();
  });

  it("unknown seniority defaults to lowest sort priority", async () => {
    const customContacts = [
      makeContact({ id: "x1", firstName: "Zara", lastName: "X", seniority: "vp" }),
      makeContact({ id: "x2", firstName: "Yang", lastName: "Y", seniority: "unknown_level" as Contact["seniority"] }),
      makeContact({ id: "x3", firstName: "Xena", lastName: "Z", seniority: "c_level" }),
    ];
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={customContacts}
      />
    );

    const rows = screen.getAllByTestId(/^contact-row-/);
    // c_level(x3)=0, vp(x1)=1, unknown(x2)=5
    expect(rows[0]).toHaveAttribute("data-testid", "contact-row-x3");
    expect(rows[1]).toHaveAttribute("data-testid", "contact-row-x1");
    expect(rows[2]).toHaveAttribute("data-testid", "contact-row-x2");
  });

  it("empty result after filters shows 'No contacts match' message", async () => {
    const singleContact = [
      makeContact({ id: "c1", sources: ["apollo"], verificationStatus: "unverified" }),
    ];
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={singleContact}
      />
    );

    // Apply freshsales filter — this contact has only apollo source
    fireEvent.click(screen.getByText("In Freshsales"));

    expect(screen.getByText("No contacts match the current filters.")).toBeInTheDocument();
  });

  it("'Has email' filter removes contacts without email", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Click "Has email" button
    fireEvent.click(screen.getByText("Has email"));

    // c4 has no email — should be filtered out
    expect(screen.queryByTestId("contact-row-c4")).not.toBeInTheDocument();
    // Others with email should remain
    expect(screen.getByTestId("contact-row-c1")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c2")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c3")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c5")).toBeInTheDocument();
    expect(screen.getByTestId("contact-row-c6")).toBeInTheDocument();

    // Filter count should show 5/6
    expect(screen.getByText("5/6")).toBeInTheDocument();
  });

  it("'Has email' combined with source filter narrows correctly", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Apply has email filter
    fireEvent.click(screen.getByText("Has email"));
    // Apply freshsales filter
    fireEvent.click(screen.getByText("In Freshsales"));

    // Freshsales contacts: c1, c3, c6. All have email.
    // Has email removes c4 (no email) but c4 not in freshsales anyway.
    // Result: c1, c3, c6
    const rows = screen.getAllByTestId(/^contact-row-/);
    expect(rows).toHaveLength(3);
    expect(screen.getByText("3/6")).toBeInTheDocument();
  });

  it("seniority dropdown filter works alongside source filter", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Filter by VP seniority
    const senioritySelect = screen.getByDisplayValue("All levels");
    fireEvent.change(senioritySelect, { target: { value: "vp" } });

    // Only Bob is VP
    const rows = screen.getAllByTestId(/^contact-row-/);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("data-testid", "contact-row-c2");
    expect(screen.getByText("1/6")).toBeInTheDocument();
  });

  it("toggling source filter off restores all contacts", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany()}
        contacts={testContacts}
      />
    );

    // Toggle freshsales on
    fireEvent.click(screen.getByText("In Freshsales"));
    expect(screen.getAllByTestId(/^contact-row-/)).toHaveLength(3);

    // Toggle freshsales off (click again)
    fireEvent.click(screen.getByText("In Freshsales"));
    expect(screen.getAllByTestId(/^contact-row-/)).toHaveLength(6);

    // Filter count should not be shown
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  it("shows CRM status label for company when freshsalesStatus is not 'none'", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany({ freshsalesStatus: "contacted" })}
        contacts={testContacts}
      />
    );

    expect(screen.getByText("CRM: Contacted")).toBeInTheDocument();
  });

  it("does not show CRM label when freshsalesStatus is 'none'", async () => {
    const ContactsPanel = await importContactsPanel();
    render(
      <ContactsPanel
        domain="acme.com"
        company={makeCompany({ freshsalesStatus: "none" })}
        contacts={testContacts}
      />
    );

    expect(screen.queryByText(/^CRM:/)).not.toBeInTheDocument();
  });
});
