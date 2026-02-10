import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { IcpWeights, AdminConfig, FreshsalesSettings } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock store — vi.mock is hoisted, so inline all values
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    adminConfig: {
      icpWeights: {
        verticalMatch: 25,
        sizeMatch: 20,
        regionMatch: 15,
        buyingSignals: 15,
        negativeSignals: -10,
        exaRelevance: 10,
        hubspotLead: 10,
        hubspotCustomer: 5,
        freshsalesLead: 10,
        freshsalesCustomer: -40,
        freshsalesRecentContact: 15,
        freshsalesTagBoost: 15,
        freshsalesTagPenalty: -20,
        freshsalesDealStalled: -10,
      },
      freshsalesSettings: {},
    },
    updateAdminConfig: vi.fn(),
  }));
  return { useStore: store };
});

import { useStore } from "@/lib/navigator/store";

// ---------------------------------------------------------------------------
// Lazy import
// ---------------------------------------------------------------------------

async function importComponent() {
  const mod = await import("@/components/navigator/admin/IcpWeightsSection");
  return mod.IcpWeightsSection;
}

// ---------------------------------------------------------------------------
// Defaults constant for tests (not used inside vi.mock)
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS: IcpWeights = {
  verticalMatch: 25,
  sizeMatch: 20,
  regionMatch: 15,
  buyingSignals: 15,
  negativeSignals: -10,
  exaRelevance: 10,
  hubspotLead: 10,
  hubspotCustomer: 5,
  freshsalesLead: 10,
  freshsalesCustomer: -40,
  freshsalesRecentContact: 15,
  freshsalesTagBoost: 15,
  freshsalesTagPenalty: -20,
  freshsalesDealStalled: -10,
};

function setWeights(weights: Partial<IcpWeights>) {
  const current = useStore.getState() as { adminConfig: { icpWeights: IcpWeights } };
  useStore.setState({
    adminConfig: {
      ...current.adminConfig,
      icpWeights: { ...current.adminConfig.icpWeights, ...weights },
    } as unknown as AdminConfig,
  });
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    adminConfig: {
      icpWeights: { ...DEFAULT_WEIGHTS },
      freshsalesSettings: {} as unknown as FreshsalesSettings,
    } as unknown as AdminConfig,
    updateAdminConfig: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IcpWeightsSection", () => {
  // -----------------------------------------------------------------------
  // 1. Renders all weight labels
  // -----------------------------------------------------------------------

  it("renders all weight field labels", async () => {
    const Component = await importComponent();
    render(<Component />);

    const expectedLabels = [
      "Vertical Match",
      "Size Match",
      "Region Match",
      "Buying Signals",
      "Negative Signals",
      "Exa Relevance",
      "HubSpot Lead",
      "HubSpot Customer",
      "Freshsales Lead",
      "Freshsales Customer",
      "Freshsales Recent Contact",
    ];

    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  // -----------------------------------------------------------------------
  // 2. Shows current weight values in number inputs
  // -----------------------------------------------------------------------

  it("displays current weight values in number inputs", async () => {
    const Component = await importComponent();
    render(<Component />);

    const numberInputs = screen.getAllByRole("spinbutton");
    const values = numberInputs.map((input) => (input as HTMLInputElement).value);

    expect(values).toContain("25"); // verticalMatch
    expect(values).toContain("20"); // sizeMatch
    expect(values).toContain("-10"); // negativeSignals
  });

  // -----------------------------------------------------------------------
  // 3. Has range sliders for each weight
  // -----------------------------------------------------------------------

  it("renders range sliders for each weight field", async () => {
    const Component = await importComponent();
    render(<Component />);

    const rangeInputs = screen.getAllByRole("slider");
    // 11 visible fields in the component
    expect(rangeInputs.length).toBe(11);
  });

  // -----------------------------------------------------------------------
  // 4. Updating a weight via number input calls updateConfig
  // -----------------------------------------------------------------------

  it("changing a number input calls updateAdminConfig with updated weights", async () => {
    const Component = await importComponent();
    render(<Component />);

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "30" } });

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        icpWeights: expect.objectContaining({
          verticalMatch: 30,
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 5. Updating a weight via range slider calls updateConfig
  // -----------------------------------------------------------------------

  it("changing a range slider calls updateAdminConfig", async () => {
    const Component = await importComponent();
    render(<Component />);

    const rangeInputs = screen.getAllByRole("slider");
    fireEvent.change(rangeInputs[0], { target: { value: "35" } });

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        icpWeights: expect.objectContaining({
          verticalMatch: 35,
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 6. Reset to defaults button
  // -----------------------------------------------------------------------

  it("Reset to Defaults button calls updateAdminConfig with default weights", async () => {
    setWeights({ verticalMatch: 50, sizeMatch: 50 });

    const Component = await importComponent();
    render(<Component />);

    const resetBtn = screen.getByText("Reset to Defaults");
    fireEvent.click(resetBtn);

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        icpWeights: expect.objectContaining({
          verticalMatch: 25,
          sizeMatch: 20,
          regionMatch: 15,
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 7. Shows sum of absolute weights
  // -----------------------------------------------------------------------

  it("displays the sum of absolute weights", async () => {
    const Component = await importComponent();
    render(<Component />);

    // Sum of defaults: 25+20+15+15+10+10+10+5+10+40+15+15+20+10 = 220
    const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + Math.abs(b), 0);
    expect(screen.getByText(`Sum of absolute weights: ${total}`)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 8. Section title and description are rendered
  // -----------------------------------------------------------------------

  it("renders section title and description", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("ICP Scoring Weights")).toBeInTheDocument();
    expect(
      screen.getByText(/Controls how companies are scored/)
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 9. Range sliders have min=-50 and max=50
  // -----------------------------------------------------------------------

  it("range sliders have min=-50 and max=50", async () => {
    const Component = await importComponent();
    render(<Component />);

    const rangeInputs = screen.getAllByRole("slider");
    const first = rangeInputs[0] as HTMLInputElement;
    expect(first.min).toBe("-50");
    expect(first.max).toBe("50");
  });
});
