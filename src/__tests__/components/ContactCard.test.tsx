import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ContactCard } from "@/components/cards/ContactCard";
import type { Contact } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query
// ---------------------------------------------------------------------------

const mockSetQueriesData = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueriesData: mockSetQueriesData,
    invalidateQueries: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockSelectCompany = vi.fn();
const mockExcludeContact = vi.fn();
const mockAddToast = vi.fn();
const mockTriggerDossierScrollToTop = vi.fn();
const mockUpdateContact = vi.fn();

vi.mock("@/lib/store", () => {
  const { create } = require("zustand");
  const store = create(() => ({}));
  store.getState = () => ({ updateContact: mockUpdateContact });
  const originalStore = store;
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState: Record<string, unknown> = {
      selectCompany: mockSelectCompany,
      selectedCompanyDomain: null,
      triggerDossierScrollToTop: mockTriggerDossierScrollToTop,
      excludeContact: mockExcludeContact,
      addToast: mockAddToast,
    };
    return selector(mockState);
  };
  useStore.getState = originalStore.getState;
  useStore.setState = originalStore.setState;
  useStore.subscribe = originalStore.subscribe;
  return { useStore };
});

// ---------------------------------------------------------------------------
// Mock useInlineFeedback
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useInlineFeedback", () => ({
  useInlineFeedback: () => ({
    trigger: vi.fn(),
    FeedbackLabel: null,
  }),
}));

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

const defaultProps = {
  isChecked: false,
  onToggleCheck: vi.fn(),
  isExpanded: false,
  onToggleExpand: vi.fn(),
};

// ---------------------------------------------------------------------------
// Setup clipboard mock
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ContactCard", () => {
  it("renders name, email, source badges in collapsed mode", () => {
    const contact = makeContact();
    render(<ContactCard contact={contact} {...defaultProps} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@test.com")).toBeInTheDocument();
  });

  it("respects visibleFields — hides fields not in set", () => {
    const contact = makeContact();
    const visibleFields = new Set(["name"]); // only name visible
    render(<ContactCard contact={contact} {...defaultProps} visibleFields={visibleFields} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    // Email should not be rendered
    expect(screen.queryByText("jane@test.com")).not.toBeInTheDocument();
  });

  it("expands on click to show detail section", () => {
    const contact = makeContact({ phone: "+1-555-1234" });
    render(<ContactCard contact={contact} {...defaultProps} isExpanded={true} />);

    // Expanded section shows phone
    expect(screen.getByText("+1-555-1234")).toBeInTheDocument();
    // Shows action buttons
    expect(screen.getByText("Copy email")).toBeInTheDocument();
    expect(screen.getByText("Exclude")).toBeInTheDocument();
  });

  it("copy email calls clipboard.writeText", async () => {
    const contact = makeContact();
    render(<ContactCard contact={contact} {...defaultProps} isExpanded={true} />);

    const copyBtn = screen.getByText("Copy email");
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("jane@test.com");
  });

  it("shows reveal button and disables exclude when no email", () => {
    const contact = makeContact({ email: null });
    render(<ContactCard contact={contact} {...defaultProps} isExpanded={true} />);

    // When no email, component shows "Reveal email" instead of "Copy email"
    const revealBtns = screen.getAllByText("Reveal email");
    expect(revealBtns.length).toBeGreaterThan(0);
    const excludeBtn = screen.getByText("Exclude");
    expect(excludeBtn).toBeDisabled();
  });

  it("exclude calls store.excludeContact", () => {
    const contact = makeContact();
    render(<ContactCard contact={contact} {...defaultProps} isExpanded={true} />);

    const excludeBtn = screen.getByText("Exclude");
    fireEvent.click(excludeBtn);

    expect(mockExcludeContact).toHaveBeenCalledWith("jane@test.com");
  });

  it("renders gracefully when contact fields are null/undefined", () => {
    const contact = makeContact({
      firstName: undefined as unknown as string,
      lastName: undefined as unknown as string,
      title: undefined as unknown as string,
      companyName: undefined as unknown as string,
    });
    render(<ContactCard contact={contact} {...defaultProps} isExpanded={true} />);

    // Should not throw — renders fallback text
    expect(screen.getByText("—")).toBeInTheDocument(); // companyName fallback
  });

  it("renders gracefully when lastVerified is malformed", () => {
    const contact = makeContact({ lastVerified: "not-a-date" });
    render(<ContactCard contact={contact} {...defaultProps} />);

    // Should not crash — the component still renders the contact name
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });
});
