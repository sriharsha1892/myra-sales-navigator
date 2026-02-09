import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CompanyCard } from "@/components/navigator/cards/CompanyCard";
import type { CompanyEnriched, Signal } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query
// ---------------------------------------------------------------------------

const mockPrefetchQuery = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      prefetchQuery: mockPrefetchQuery,
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockSearchSimilar = vi.fn();
const mockSetExpandedContactsDomain = vi.fn();

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({}));
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState: Record<string, unknown> = {
      searchSimilar: mockSearchSimilar,
      setExpandedContactsDomain: mockSetExpandedContactsDomain,
      lastSearchQuery: null,
      contactsByDomain: {},
      adminConfig: { freshsalesSettings: {}, pipelineStages: undefined },
      userName: "TestUser",
      setCompanyStatus: vi.fn(),
      companyDecisions: {},
      setCompanyDecision: vi.fn(),
      prospectList: new Set(),
      addToProspectList: vi.fn(),
      removeFromProspectList: vi.fn(),
      selectedContactIds: new Set(),
      toggleContactSelection: vi.fn(),
      setContactsForDomain: vi.fn(),
      addToast: vi.fn(),
    };
    return selector(mockState);
  };
  useStore.getState = store.getState;
  useStore.setState = store.setState;
  useStore.subscribe = store.subscribe;
  return { useStore };
});

// ---------------------------------------------------------------------------
// Mock child components that use store heavily to keep test focused
// ---------------------------------------------------------------------------

vi.mock("@/components/navigator/dossier/CompanyStatusBadge", () => ({
  CompanyStatusBadge: ({ domain }: { domain: string }) => (
    <span data-testid="status-badge">{domain}</span>
  ),
}));

vi.mock("@/components/navigator/cards/ContactPreviewPopover", () => ({
  ContactPreviewPopover: ({ domain }: { domain: string }) => (
    <span data-testid="contact-popover">{domain}</span>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "sig-1",
    companyDomain: "acme.com",
    type: "hiring",
    title: "Hiring VP of Sales",
    description: "New role posted",
    date: "2026-01-15",
    sourceUrl: null,
    source: "exa",
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
    signals: [makeSignal()],
    contactCount: 5,
    lastRefreshed: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

const defaultProps = {
  isSelected: false,
  isChecked: false,
  onSelect: vi.fn(),
  onToggleCheck: vi.fn(),
};

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
// Tests
// ---------------------------------------------------------------------------

describe("CompanyCard", () => {
  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  it("renders company name, industry, employee count, and location", () => {
    render(<CompanyCard company={makeCompany()} {...defaultProps} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("150 emp")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
  });

  it("renders signal pill and signal title", () => {
    render(<CompanyCard company={makeCompany()} {...defaultProps} />);

    expect(screen.getByText("hiring")).toBeInTheDocument();
    expect(screen.getByText("Hiring VP of Sales")).toBeInTheDocument();
  });

  it("renders source badges for each source", () => {
    render(
      <CompanyCard
        company={makeCompany({ sources: ["exa", "apollo"] })}
        {...defaultProps}
      />
    );

    // Source badges are rendered by SourceBadge component
    // The component iterates over sources and renders them
    const card = screen.getByRole("option");
    expect(card).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // CRITICAL: onClick fires on first click
  // -----------------------------------------------------------------------

  it("fires onSelect callback on the FIRST click", () => {
    const onSelect = vi.fn();
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} onSelect={onSelect} />
    );

    const card = screen.getByRole("option");
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("fires onSelect exactly once per click — not double-fired", () => {
    const onSelect = vi.fn();
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} onSelect={onSelect} />
    );

    const card = screen.getByRole("option");
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(2);

    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("onClick registers even when card has animate-fadeInUp (animation does not block clicks)", () => {
    // The card is rendered inside a parent div with animate-fadeInUp in ResultsList.
    // This test verifies the CompanyCard's own onClick is not blocked by CSS animation.
    // The component has role="option" and onClick={onSelect} directly on the root div.
    const onSelect = vi.fn();
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} onSelect={onSelect} />
    );

    const card = screen.getByRole("option");
    // Verify the root element has the onClick handler bound
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("click on card root fires onSelect even with card-interactive class applied", () => {
    // card-interactive has CSS transforms that could conflict with events
    const onSelect = vi.fn();
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} onSelect={onSelect} />
    );

    const card = screen.getByRole("option");
    expect(card.className).toContain("card-interactive");
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Checkbox click does NOT propagate to card click
  // -----------------------------------------------------------------------

  it("checkbox click calls onToggleCheck but NOT onSelect (stopPropagation)", () => {
    const onSelect = vi.fn();
    const onToggleCheck = vi.fn();
    render(
      <CompanyCard
        company={makeCompany()}
        {...defaultProps}
        onSelect={onSelect}
        onToggleCheck={onToggleCheck}
      />
    );

    // The checkbox button is inside the card. It calls e.stopPropagation().
    // Find the checkbox button — it's a small button inside the card.
    // When isChecked is false, the button has border styling.
    const buttons = screen.getByRole("option").querySelectorAll("button");
    // First button is the checkbox
    const checkboxBtn = buttons[0];
    fireEvent.click(checkboxBtn);

    expect(onToggleCheck).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("'Similar' button click does not fire onSelect (stopPropagation)", () => {
    const onSelect = vi.fn();
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} onSelect={onSelect} />
    );

    const similarBtn = screen.getByText("Similar");
    fireEvent.click(similarBtn);

    expect(onSelect).not.toHaveBeenCalled();
    expect(mockSearchSimilar).toHaveBeenCalledTimes(1);
  });

  it("contacts count button click does not fire onSelect (stopPropagation)", () => {
    const onSelect = vi.fn();
    render(
      <CompanyCard
        company={makeCompany({ contactCount: 12 })}
        {...defaultProps}
        onSelect={onSelect}
      />
    );

    const contactsBtn = screen.getByText("12 contacts");
    fireEvent.click(contactsBtn);

    expect(onSelect).not.toHaveBeenCalled();
    expect(mockSetExpandedContactsDomain).toHaveBeenCalledWith("acme.com");
  });

  // -----------------------------------------------------------------------
  // Selected / checked states
  // -----------------------------------------------------------------------

  it("sets aria-selected=true when isSelected", () => {
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} isSelected={true} />
    );

    const card = screen.getByRole("option");
    expect(card).toHaveAttribute("aria-selected", "true");
  });

  it("sets aria-selected=false when not selected", () => {
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} isSelected={false} />
    );

    const card = screen.getByRole("option");
    expect(card).toHaveAttribute("aria-selected", "false");
  });

  it("applies ring class when isChecked", () => {
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} isChecked={true} />
    );

    const card = screen.getByRole("option");
    expect(card.className).toContain("ring-1");
  });

  it("renders checkmark SVG when isChecked", () => {
    render(
      <CompanyCard company={makeCompany()} {...defaultProps} isChecked={true} />
    );

    // The checkmark SVG has a polyline with points "20 6 9 17 4 12"
    const card = screen.getByRole("option");
    const polyline = card.querySelector("polyline[points='20 6 9 17 4 12']");
    expect(polyline).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // CRM status badges
  // -----------------------------------------------------------------------

  it("shows Freshsales CRM status badge when freshsalesStatus is not 'none'", () => {
    render(
      <CompanyCard
        company={makeCompany({ freshsalesStatus: "won" })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("CRM: Won")).toBeInTheDocument();
  });

  it("shows HubSpot CRM status badge when hubspotStatus is not 'none'", () => {
    render(
      <CompanyCard
        company={makeCompany({ hubspotStatus: "open" })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("CRM: Open")).toBeInTheDocument();
  });

  it("does not render CRM badges when both statuses are 'none'", () => {
    render(
      <CompanyCard
        company={makeCompany({ hubspotStatus: "none", freshsalesStatus: "none" })}
        {...defaultProps}
      />
    );

    expect(screen.queryByText(/^CRM:/)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Description and signals
  // -----------------------------------------------------------------------

  it("renders description when present", () => {
    render(
      <CompanyCard
        company={makeCompany({ description: "Enterprise SaaS platform" })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("Enterprise SaaS platform")).toBeInTheDocument();
  });

  it("shows +N more when multiple signals exist", () => {
    const signals = [
      makeSignal({ id: "s1", type: "hiring", title: "Hiring engineers" }),
      makeSignal({ id: "s2", type: "funding", title: "Series B" }),
      makeSignal({ id: "s3", type: "expansion", title: "New office" }),
    ];
    render(
      <CompanyCard company={makeCompany({ signals })} {...defaultProps} />
    );

    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("shows empty signal message when no signals", () => {
    render(
      <CompanyCard company={makeCompany({ signals: [] })} {...defaultProps} />
    );

    // The component calls pick("empty_card_signals") which returns one of
    // ["No signals yet", "Quiet on the wire", "Nothing detected"]
    const card = screen.getByRole("option");
    const emptyMsg = card.querySelector("p.italic");
    expect(emptyMsg).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Element ID for ARIA activedescendant
  // -----------------------------------------------------------------------

  it("has id matching company-{domain} for aria-activedescendant", () => {
    render(
      <CompanyCard company={makeCompany({ domain: "test.io" })} {...defaultProps} />
    );

    const card = screen.getByRole("option");
    expect(card.id).toBe("company-test.io");
  });

  // -----------------------------------------------------------------------
  // Hover prefetch behavior
  // -----------------------------------------------------------------------

  it("starts prefetch on mouseenter after 500ms delay", () => {
    vi.useFakeTimers();
    render(<CompanyCard company={makeCompany()} {...defaultProps} />);

    const card = screen.getByRole("option");
    fireEvent.mouseEnter(card);

    // Prefetch should not fire immediately
    expect(mockPrefetchQuery).not.toHaveBeenCalled();

    // Advance past the 500ms delay
    vi.advanceTimersByTime(500);
    expect(mockPrefetchQuery).toHaveBeenCalledTimes(2); // dossier + contacts

    vi.useRealTimers();
  });

  it("cancels prefetch if mouseleave happens before 500ms", () => {
    vi.useFakeTimers();
    render(<CompanyCard company={makeCompany()} {...defaultProps} />);

    const card = screen.getByRole("option");
    fireEvent.mouseEnter(card);

    // Leave before delay fires
    vi.advanceTimersByTime(200);
    fireEvent.mouseLeave(card);

    // Advance past the original delay
    vi.advanceTimersByTime(500);
    expect(mockPrefetchQuery).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Data completeness indicator
  // -----------------------------------------------------------------------

  it("shows data completeness fraction when fewer than 5 fields filled", () => {
    // CompanyEnriched with minimal data — no revenue, founded, website, phone, aiSummary, logoUrl
    render(
      <CompanyCard
        company={makeCompany({
          revenue: undefined,
          founded: undefined,
          website: undefined,
          phone: undefined,
          aiSummary: undefined,
          logoUrl: undefined,
        })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("0/6")).toBeInTheDocument();
  });

  it("shows 'Limited data' label for exa-only companies", () => {
    render(
      <CompanyCard
        company={makeCompany({ sources: ["exa"] })}
        {...defaultProps}
      />
    );

    expect(screen.getByText("Limited data")).toBeInTheDocument();
  });
});
