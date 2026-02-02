import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ContactCard } from "@/components/cards/ContactCard";
import type { Contact } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockSelectCompany = vi.fn();
const mockExcludeContact = vi.fn();
const mockAddToast = vi.fn();

vi.mock("@/lib/store", () => {
  const { create } = require("zustand");
  const store = create(() => ({}));
  store.getState = () => ({});
  // Override the hook to return mock selectors
  const originalStore = store;
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState: Record<string, unknown> = {
      selectCompany: mockSelectCompany,
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

  it("copy/exclude buttons disabled when no email", () => {
    const contact = makeContact({ email: null });
    render(<ContactCard contact={contact} {...defaultProps} isExpanded={true} />);

    const copyBtn = screen.getByText("Copy email");
    const excludeBtn = screen.getByText("Exclude");
    expect(copyBtn).toBeDisabled();
    expect(excludeBtn).toBeDisabled();
  });

  it("exclude calls store.excludeContact", () => {
    const contact = makeContact();
    render(<ContactCard contact={contact} {...defaultProps} isExpanded={true} />);

    const excludeBtn = screen.getByText("Exclude");
    fireEvent.click(excludeBtn);

    expect(mockExcludeContact).toHaveBeenCalledWith("jane@test.com");
  });
});
