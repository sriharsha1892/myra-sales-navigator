import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { VerificationProgress } from "@/components/export/VerificationProgress";
import type { ExportFlowState } from "@/lib/types";

function makeState(overrides: Partial<ExportFlowState> = {}): ExportFlowState {
  return {
    step: "verify",
    contactIds: ["c1", "c2", "c3"],
    verificationResults: new Map(),
    verifiedCount: 0,
    totalCount: 3,
    mode: "clipboard",
    ...overrides,
  };
}

// Overlay uses createPortal → rendered content lives in document.body, not container
function getProgressFill(): HTMLElement | null {
  return document.body.querySelector(".bg-accent-primary");
}

describe("VerificationProgress", () => {
  afterEach(() => {
    cleanup();
  });

  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  it("renders verifying message with correct count", () => {
    render(<VerificationProgress exportState={makeState({ totalCount: 5 })} />);
    expect(screen.getByText("Verifying 5 emails...")).toBeInTheDocument();
  });

  it("uses singular 'email' when totalCount is 1", () => {
    render(<VerificationProgress exportState={makeState({ totalCount: 1 })} />);
    expect(screen.getByText("Verifying 1 email...")).toBeInTheDocument();
  });

  it("shows verified / total counter", () => {
    render(
      <VerificationProgress
        exportState={makeState({ verifiedCount: 2, totalCount: 5 })}
      />
    );
    expect(screen.getByText("2 / 5 verified")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Progress bar
  // -----------------------------------------------------------------------

  it("renders progress bar at 0% when verifiedCount is 0", () => {
    render(
      <VerificationProgress exportState={makeState({ verifiedCount: 0, totalCount: 4 })} />
    );
    const fill = getProgressFill();
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe("0%");
  });

  it("renders progress bar at 50% when half verified", () => {
    render(
      <VerificationProgress exportState={makeState({ verifiedCount: 2, totalCount: 4 })} />
    );
    const fill = getProgressFill();
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe("50%");
  });

  it("renders progress bar at 100% when all verified", () => {
    render(
      <VerificationProgress exportState={makeState({ verifiedCount: 4, totalCount: 4 })} />
    );
    const fill = getProgressFill();
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe("100%");
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("handles totalCount 0 without division error (shows 0%)", () => {
    render(
      <VerificationProgress exportState={makeState({ verifiedCount: 0, totalCount: 0 })} />
    );
    const fill = getProgressFill();
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe("0%");
    expect(screen.getByText("0 / 0 verified")).toBeInTheDocument();
  });

  it("renders progress bar at 33% (rounds correctly)", () => {
    render(
      <VerificationProgress exportState={makeState({ verifiedCount: 1, totalCount: 3 })} />
    );
    const fill = getProgressFill();
    expect(fill).toBeTruthy();
    expect(fill!.style.width).toBe("33%");
  });

  it("updates display when props change", () => {
    const { rerender } = render(
      <VerificationProgress exportState={makeState({ verifiedCount: 1, totalCount: 3 })} />
    );
    expect(screen.getByText("1 / 3 verified")).toBeInTheDocument();

    rerender(
      <VerificationProgress exportState={makeState({ verifiedCount: 3, totalCount: 3 })} />
    );
    expect(screen.getByText("3 / 3 verified")).toBeInTheDocument();
  });
});
