import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { Exclusion } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock store — vi.mock is hoisted, so no external variable references inside
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    exclusions: [] as Exclusion[],
    addToast: vi.fn(),
    addProgressToast: vi.fn(() => ({ resolve: vi.fn(), reject: vi.fn() })),
    addUndoToast: vi.fn(),
    userName: "Adi",
    updateAdminConfig: vi.fn(),
    adminConfig: { freshsalesSettings: {} },
  }));
  return { useStore: store };
});

import { useStore } from "@/lib/navigator/store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExclusion(overrides: Partial<Exclusion> = {}): Exclusion {
  return {
    id: "exc-1",
    type: "company",
    value: "competitor.com",
    reason: "Direct competitor",
    addedBy: "Adi",
    addedAt: "2026-01-15T10:00:00Z",
    source: "manual",
    ...overrides,
  };
}

function setExclusions(exclusions: Exclusion[]) {
  useStore.setState({ exclusions });
}

// ---------------------------------------------------------------------------
// Lazy import to ensure mocks are in place
// ---------------------------------------------------------------------------

async function importComponent() {
  const mod = await import(
    "@/components/navigator/admin/ExclusionManagerSection"
  );
  return mod.ExclusionManagerSection;
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exclusion: makeExclusion(), inserted: 1, exclusions: [] }),
    })
  );
  setExclusions([]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExclusionManagerSection", () => {
  // -----------------------------------------------------------------------
  // 1. Renders exclusion list
  // -----------------------------------------------------------------------

  it("renders exclusion items with type badges, values, and added-by", async () => {
    const exclusions = [
      makeExclusion({ id: "e1", type: "domain", value: "badco.com", addedBy: "Satish" }),
      makeExclusion({ id: "e2", type: "email", value: "spam@test.com", addedBy: "Adi" }),
    ];
    setExclusions(exclusions);

    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("badco.com")).toBeInTheDocument();
    expect(screen.getByText("spam@test.com")).toBeInTheDocument();
    expect(screen.getByText("domain")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("by Satish")).toBeInTheDocument();
    expect(screen.getByText("by Adi")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Shows empty state when no exclusions
  // -----------------------------------------------------------------------

  it("shows 'No exclusions found' when list is empty", async () => {
    setExclusions([]);

    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText(/No exclusions found/)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 3. Add exclusion form works (type selector + value input)
  // -----------------------------------------------------------------------

  it("adds exclusion via form — type select, value input, and Add button", async () => {
    setExclusions([]);

    const Component = await importComponent();
    render(<Component />);

    // Select type
    const typeSelect = screen.getByDisplayValue("Company");
    fireEvent.change(typeSelect, { target: { value: "domain" } });

    // Enter value
    const valueInput = screen.getByPlaceholderText("Value to exclude...");
    fireEvent.change(valueInput, { target: { value: "newexclusion.com" } });

    // Click Add
    const addBtn = screen.getByText("Add");
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/exclusions", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("newexclusion.com"),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // 4. Delete exclusion button calls handler
  // -----------------------------------------------------------------------

  it("delete button removes exclusion optimistically and triggers undo toast", async () => {
    const exclusion = makeExclusion({ id: "e-del", value: "removeme.com" });
    setExclusions([exclusion]);

    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("removeme.com")).toBeInTheDocument();

    const removeBtn = screen.getByLabelText("Remove exclusion");
    fireEvent.click(removeBtn);

    // Optimistic removal — value should be gone
    expect(screen.queryByText("removeme.com")).not.toBeInTheDocument();
    // Undo toast should have been called
    expect(useStore.getState().addUndoToast).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // 5. CSV upload area is present
  // -----------------------------------------------------------------------

  it("renders CSV upload drop zone with instructions", async () => {
    setExclusions([]);

    const Component = await importComponent();
    render(<Component />);

    expect(
      screen.getByText("Drop a CSV file here, or click to browse")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/CSV format: one entry per line/)
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 6. Search/filter exclusions
  // -----------------------------------------------------------------------

  it("filters exclusions by search input", async () => {
    const exclusions = [
      makeExclusion({ id: "e1", value: "alpha.com", type: "domain" }),
      makeExclusion({ id: "e2", value: "beta.com", type: "domain" }),
      makeExclusion({ id: "e3", value: "gamma@test.com", type: "email" }),
    ];
    setExclusions(exclusions);

    const Component = await importComponent();
    render(<Component />);

    // All visible initially
    expect(screen.getByText("alpha.com")).toBeInTheDocument();
    expect(screen.getByText("beta.com")).toBeInTheDocument();
    expect(screen.getByText("gamma@test.com")).toBeInTheDocument();

    // Type in search
    const searchInput = screen.getByPlaceholderText("Search exclusions...");
    fireEvent.change(searchInput, { target: { value: "alpha" } });

    // Only alpha visible
    expect(screen.getByText("alpha.com")).toBeInTheDocument();
    expect(screen.queryByText("beta.com")).not.toBeInTheDocument();
    expect(screen.queryByText("gamma@test.com")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 7. Shows count of exclusions with type breakdown
  // -----------------------------------------------------------------------

  it("shows total count and type breakdown", async () => {
    const exclusions = [
      makeExclusion({ id: "e1", type: "domain", value: "a.com" }),
      makeExclusion({ id: "e2", type: "domain", value: "b.com" }),
      makeExclusion({ id: "e3", type: "company", value: "CompanyX" }),
      makeExclusion({ id: "e4", type: "email", value: "x@y.com" }),
    ];
    setExclusions(exclusions);

    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText(/4 exclusions/)).toBeInTheDocument();
    expect(screen.getByText(/2 domains/)).toBeInTheDocument();
    expect(screen.getByText(/1 companies/)).toBeInTheDocument();
    expect(screen.getByText(/1 emails/)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 8. Add button disabled when value is empty
  // -----------------------------------------------------------------------

  it("Add button is disabled when value input is empty", async () => {
    setExclusions([]);

    const Component = await importComponent();
    render(<Component />);

    const addBtn = screen.getByText("Add");
    expect(addBtn).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // 9. Reason field is passed through to API
  // -----------------------------------------------------------------------

  it("reason field is included in the add request", async () => {
    setExclusions([]);

    const Component = await importComponent();
    render(<Component />);

    const valueInput = screen.getByPlaceholderText("Value to exclude...");
    fireEvent.change(valueInput, { target: { value: "test.com" } });

    const reasonInput = screen.getByPlaceholderText("Reason (optional)");
    fireEvent.change(reasonInput, { target: { value: "Competitor" } });

    const addBtn = screen.getByText("Add");
    fireEvent.click(addBtn);

    await waitFor(() => {
      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.reason).toBe("Competitor");
    });
  });

  // -----------------------------------------------------------------------
  // 10. Shows truncated reason on exclusion items
  // -----------------------------------------------------------------------

  it("truncates long reasons with ellipsis", async () => {
    const longReason = "This is a very long reason that should be truncated";
    setExclusions([
      makeExclusion({ id: "e1", value: "long.com", reason: longReason }),
    ]);

    const Component = await importComponent();
    render(<Component />);

    // Reason should be truncated to 20 chars + "..."
    expect(screen.getByText("This is a very long ...")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 11. Enter key on value input triggers add
  // -----------------------------------------------------------------------

  it("pressing Enter in value input triggers add", async () => {
    setExclusions([]);

    const Component = await importComponent();
    render(<Component />);

    const valueInput = screen.getByPlaceholderText("Value to exclude...");
    fireEvent.change(valueInput, { target: { value: "enter-test.com" } });
    fireEvent.keyDown(valueInput, { key: "Enter" });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/exclusions", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("enter-test.com"),
      }));
    });
  });
});
