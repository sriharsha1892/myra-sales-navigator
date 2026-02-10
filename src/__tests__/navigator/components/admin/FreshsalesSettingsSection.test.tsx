import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { FreshsalesSettings, IcpWeights, AdminConfig } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock store — vi.mock is hoisted, all values must be inline
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    adminConfig: {
      freshsalesSettings: {
        enabled: true,
        domain: "mordorintelligence",
        sectionTitle: "Mordor Intelligence CRM",
        emptyStateLabel: "No record in Freshsales",
        statusLabels: {
          none: "Not in CRM",
          new_lead: "New Lead",
          contacted: "Contacted",
          negotiation: "Deal in Progress",
          won: "Customer",
          customer: "Customer",
          lost: "Deal Lost",
        },
        showDeals: true,
        showContacts: true,
        showActivity: true,
        recentActivityDaysThreshold: 30,
        cacheTtlMinutes: 30,
        icpWeights: {
          freshsalesLead: 10,
          freshsalesCustomer: -40,
          freshsalesRecentContact: 15,
        },
        showOwner: true,
        showTags: true,
        showDealVelocity: true,
        stalledDealThresholdDays: 30,
        tagScoringRules: {
          boostTags: ["decision maker", "champion", "key contact"],
          boostPoints: 15,
          penaltyTags: ["churned", "bad fit", "competitor"],
          penaltyPoints: -20,
          excludeTags: ["dnc", "do not contact", "unsubscribed"],
        },
        enablePushContact: true,
        enableTaskCreation: true,
        defaultTaskDueDays: 3,
      },
      icpWeights: {},
    },
    updateAdminConfig: vi.fn(),
  }));
  return { useStore: store };
});

// Mock the defaultFreshsalesSettings import used by the component's Reset button
vi.mock("@/lib/navigator/mock-data", () => ({
  defaultFreshsalesSettings: {
    enabled: true,
    domain: "mordorintelligence",
    sectionTitle: "Mordor Intelligence CRM",
    emptyStateLabel: "No record in Freshsales",
    statusLabels: {
      none: "Not in CRM",
      new_lead: "New Lead",
      contacted: "Contacted",
      negotiation: "Deal in Progress",
      won: "Customer",
      customer: "Customer",
      lost: "Deal Lost",
    },
    showDeals: true,
    showContacts: true,
    showActivity: true,
    recentActivityDaysThreshold: 30,
    cacheTtlMinutes: 30,
    icpWeights: {
      freshsalesLead: 10,
      freshsalesCustomer: -40,
      freshsalesRecentContact: 15,
    },
    showOwner: true,
    showTags: true,
    showDealVelocity: true,
    stalledDealThresholdDays: 30,
    tagScoringRules: {
      boostTags: ["decision maker", "champion", "key contact"],
      boostPoints: 15,
      penaltyTags: ["churned", "bad fit", "competitor"],
      penaltyPoints: -20,
      excludeTags: ["dnc", "do not contact", "unsubscribed"],
    },
    enablePushContact: true,
    enableTaskCreation: true,
    defaultTaskDueDays: 3,
  },
}));

import { useStore } from "@/lib/navigator/store";

// ---------------------------------------------------------------------------
// Defaults for use in beforeEach (NOT inside vi.mock)
// ---------------------------------------------------------------------------

const DEFAULTS: FreshsalesSettings = {
  enabled: true,
  domain: "mordorintelligence",
  sectionTitle: "Mordor Intelligence CRM",
  emptyStateLabel: "No record in Freshsales",
  statusLabels: {
    none: "Not in CRM",
    new_lead: "New Lead",
    contacted: "Contacted",
    negotiation: "Deal in Progress",
    won: "Customer",
    customer: "Customer",
    lost: "Deal Lost",
  },
  showDeals: true,
  showContacts: true,
  showActivity: true,
  recentActivityDaysThreshold: 30,
  cacheTtlMinutes: 30,
  icpWeights: {
    freshsalesLead: 10,
    freshsalesCustomer: -40,
    freshsalesRecentContact: 15,
  },
  showOwner: true,
  showTags: true,
  showDealVelocity: true,
  stalledDealThresholdDays: 30,
  tagScoringRules: {
    boostTags: ["decision maker", "champion", "key contact"],
    boostPoints: 15,
    penaltyTags: ["churned", "bad fit", "competitor"],
    penaltyPoints: -20,
    excludeTags: ["dnc", "do not contact", "unsubscribed"],
  },
  enablePushContact: true,
  enableTaskCreation: true,
  defaultTaskDueDays: 3,
};

// ---------------------------------------------------------------------------
// Lazy import
// ---------------------------------------------------------------------------

async function importComponent() {
  const mod = await import(
    "@/components/navigator/admin/FreshsalesSettingsSection"
  );
  return mod.FreshsalesSettingsSection;
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    adminConfig: {
      freshsalesSettings: { ...DEFAULTS },
      icpWeights: {} as unknown as IcpWeights,
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

describe("FreshsalesSettingsSection", () => {
  // -----------------------------------------------------------------------
  // 1. Renders section title and description
  // -----------------------------------------------------------------------

  it("renders section title and description", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Freshsales Settings")).toBeInTheDocument();
    expect(
      screen.getByText(/Configure Freshsales CRM integration/)
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Shows connection section with enable checkbox
  // -----------------------------------------------------------------------

  it("renders Connection section with enable checkbox checked", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Connection")).toBeInTheDocument();
    const enableCheckbox = screen.getByLabelText(
      "Enable Freshsales integration"
    );
    expect(enableCheckbox).toBeChecked();
  });

  // -----------------------------------------------------------------------
  // 3. Domain input works
  // -----------------------------------------------------------------------

  it("domain input shows current value and calls update on change", async () => {
    const Component = await importComponent();
    render(<Component />);

    const domainInput = screen.getByDisplayValue("mordorintelligence");
    expect(domainInput).toBeInTheDocument();

    // Suffix label
    expect(screen.getByText(".freshsales.io")).toBeInTheDocument();

    fireEvent.change(domainInput, { target: { value: "newdomain" } });

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        freshsalesSettings: expect.objectContaining({
          domain: "newdomain",
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 4. Toggle enabled/disabled
  // -----------------------------------------------------------------------

  it("toggling enable checkbox calls updateAdminConfig with enabled: false", async () => {
    const Component = await importComponent();
    render(<Component />);

    const enableCheckbox = screen.getByLabelText(
      "Enable Freshsales integration"
    );
    fireEvent.click(enableCheckbox);

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        freshsalesSettings: expect.objectContaining({
          enabled: false,
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 5. Status labels rendered for all status keys
  // -----------------------------------------------------------------------

  it("renders all 7 status label inputs", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Status Labels")).toBeInTheDocument();

    const statusKeys = [
      "none",
      "new_lead",
      "contacted",
      "negotiation",
      "won",
      "customer",
      "lost",
    ];
    for (const key of statusKeys) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }

    expect(screen.getByDisplayValue("Not in CRM")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Lead")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Deal in Progress")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 6. Dossier visibility toggles
  // -----------------------------------------------------------------------

  it("renders dossier visibility checkboxes", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Dossier Visibility")).toBeInTheDocument();
    expect(screen.getByLabelText("Show Deals")).toBeChecked();
    expect(screen.getByLabelText("Show Contacts")).toBeChecked();
    expect(screen.getByLabelText("Show Recent Activity")).toBeChecked();
  });

  it("toggling Show Deals calls updateAdminConfig", async () => {
    const Component = await importComponent();
    render(<Component />);

    const dealsCheckbox = screen.getByLabelText("Show Deals");
    fireEvent.click(dealsCheckbox);

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        freshsalesSettings: expect.objectContaining({
          showDeals: false,
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 7. Cache TTL slider
  // -----------------------------------------------------------------------

  it("renders cache TTL slider with current value", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Cache TTL")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 8. Reset to Defaults button
  // -----------------------------------------------------------------------

  it("Reset to Defaults button calls updateAdminConfig with defaults", async () => {
    const Component = await importComponent();
    render(<Component />);

    const resetBtn = screen.getByText("Reset to Defaults");
    fireEvent.click(resetBtn);

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        freshsalesSettings: expect.objectContaining({
          domain: "mordorintelligence",
          enabled: true,
        }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 9. ICP scoring sliders present
  // -----------------------------------------------------------------------

  it("renders Freshsales ICP scoring sliders", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("ICP Scoring")).toBeInTheDocument();
    expect(screen.getByText("Freshsales Lead")).toBeInTheDocument();
    expect(screen.getByText("Freshsales Customer")).toBeInTheDocument();
    expect(screen.getByText("Recent Contact")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 10. Write operations section
  // -----------------------------------------------------------------------

  it("renders Write Operations section with toggles", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Write Operations")).toBeInTheDocument();
    expect(
      screen.getByText(/Enable pushing data back to Freshsales/)
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 11. Engagement alert threshold
  // -----------------------------------------------------------------------

  it("renders Engagement Alert section with threshold input", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Engagement Alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Highlight if research team contacted within/)
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 12. Tag scoring section
  // -----------------------------------------------------------------------

  it("renders Tag Scoring section with boost/penalty/exclude inputs", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Tag Scoring")).toBeInTheDocument();
    expect(screen.getByText("Boost tags (comma-separated)")).toBeInTheDocument();
    expect(screen.getByText("Penalty tags (comma-separated)")).toBeInTheDocument();
    expect(screen.getByText("Auto-exclude tags (comma-separated)")).toBeInTheDocument();

    expect(
      screen.getByDisplayValue("decision maker, champion, key contact")
    ).toBeInTheDocument();
  });
});
