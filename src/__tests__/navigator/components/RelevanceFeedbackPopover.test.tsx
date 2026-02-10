import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RelevanceFeedbackPopover } from "@/components/navigator/cards/RelevanceFeedbackPopover";
import type { RelevanceFeedbackReason } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockOnSelect = vi.fn();
const mockOnClose = vi.fn();

function renderPopover() {
  return render(
    <RelevanceFeedbackPopover
      domain="acme.com"
      onSelect={mockOnSelect}
      onClose={mockOnClose}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RelevanceFeedbackPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // --- Rendering -----------------------------------------------------------

  it("renders the prompt text", () => {
    renderPopover();
    expect(screen.getByText("Why not relevant?")).toBeTruthy();
  });

  it("renders all 5 reason pills", () => {
    renderPopover();

    const expectedLabels = [
      "Wrong industry",
      "Wrong region",
      "Too small/large",
      "No contacts",
      "Stale signals",
    ];

    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("renders exactly 5 buttons", () => {
    renderPopover();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
  });

  // --- Click behavior ------------------------------------------------------

  it("calls onSelect with 'wrong_industry' when clicking 'Wrong industry'", () => {
    renderPopover();
    fireEvent.click(screen.getByText("Wrong industry"));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith("wrong_industry");
  });

  it("calls onSelect with 'wrong_region' when clicking 'Wrong region'", () => {
    renderPopover();
    fireEvent.click(screen.getByText("Wrong region"));
    expect(mockOnSelect).toHaveBeenCalledWith("wrong_region");
  });

  it("calls onSelect with 'wrong_size' when clicking 'Too small/large'", () => {
    renderPopover();
    fireEvent.click(screen.getByText("Too small/large"));
    expect(mockOnSelect).toHaveBeenCalledWith("wrong_size");
  });

  it("calls onSelect with 'no_actionable_contacts' when clicking 'No contacts'", () => {
    renderPopover();
    fireEvent.click(screen.getByText("No contacts"));
    expect(mockOnSelect).toHaveBeenCalledWith("no_actionable_contacts");
  });

  it("calls onSelect with 'irrelevant_signals' when clicking 'Stale signals'", () => {
    renderPopover();
    fireEvent.click(screen.getByText("Stale signals"));
    expect(mockOnSelect).toHaveBeenCalledWith("irrelevant_signals");
  });

  // --- Reason mapping check ------------------------------------------------

  it("maps each label to the correct RelevanceFeedbackReason value", () => {
    renderPopover();

    const mappings: [string, RelevanceFeedbackReason][] = [
      ["Wrong industry", "wrong_industry"],
      ["Wrong region", "wrong_region"],
      ["Too small/large", "wrong_size"],
      ["No contacts", "no_actionable_contacts"],
      ["Stale signals", "irrelevant_signals"],
    ];

    for (const [label, reason] of mappings) {
      mockOnSelect.mockClear();
      fireEvent.click(screen.getByText(label));
      expect(mockOnSelect).toHaveBeenCalledWith(reason);
    }
  });

  // --- Escape to close -----------------------------------------------------

  it("calls onClose when Escape key is pressed", () => {
    renderPopover();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for other keys", () => {
    renderPopover();
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "a" });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // --- Outside click -------------------------------------------------------

  it("calls onClose when clicking outside the popover", () => {
    renderPopover();
    fireEvent.mouseDown(document.body);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the popover", () => {
    renderPopover();
    const pill = screen.getByText("Wrong industry");
    fireEvent.mouseDown(pill);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // --- Click stopPropagation -----------------------------------------------

  it("stops propagation on popover container click", () => {
    renderPopover();
    const container = screen.getByText("Why not relevant?").closest("div")!;
    const clickEvent = new MouseEvent("click", { bubbles: true });
    const spy = vi.spyOn(clickEvent, "stopPropagation");
    container.dispatchEvent(clickEvent);
    expect(spy).toHaveBeenCalled();
  });

  // --- Cleanup on unmount --------------------------------------------------

  it("removes event listeners on unmount", () => {
    const { unmount } = renderPopover();
    unmount();
    // After unmount, pressing Escape should NOT call onClose
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
