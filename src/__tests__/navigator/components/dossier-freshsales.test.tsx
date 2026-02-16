import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type {
  CompanyEnriched,
  FreshsalesIntel,
  FreshsalesSettings,
  FreshsalesDeal,
  FreshsalesActivity,
  Contact,
} from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

let mockFreshsalesSettings: Partial<FreshsalesSettings> = {};
let mockIsAdmin = false;

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({}));
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState: Record<string, unknown> = {
      adminConfig: { freshsalesSettings: mockFreshsalesSettings },
      isAdmin: mockIsAdmin,
    };
    return selector(mockState);
  };
  useStore.getState = store.getState;
  useStore.setState = store.setState;
  useStore.subscribe = store.subscribe;
  return { useStore };
});

// ---------------------------------------------------------------------------
// Mock child components
// ---------------------------------------------------------------------------

vi.mock("@/components/navigator/shared/MissingData", () => ({
  MissingData: ({ label }: { label: string }) => (
    <span data-testid="missing-data">{label}</span>
  ),
}));

vi.mock("@/components/navigator/freshsales/CreateTaskInline", () => ({
  CreateTaskInline: () => <div data-testid="create-task-inline" />,
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
    sources: ["freshsales"],
    seniority: "vp",
    lastVerified: null,
    ...overrides,
  };
}

function makeDeal(overrides: Partial<FreshsalesDeal> = {}): FreshsalesDeal {
  return {
    id: 1,
    name: "Enterprise License",
    amount: 150000,
    stage: "Negotiation",
    probability: 70,
    expectedClose: "2026-03-15",
    createdAt: "2026-01-10",
    updatedAt: "2026-02-01",
    daysInStage: 15,
    ...overrides,
  };
}

function makeIntel(overrides: Partial<FreshsalesIntel> = {}): FreshsalesIntel {
  return {
    domain: "acme.com",
    status: "contacted",
    account: {
      id: 42,
      name: "Acme Corporation",
      website: "https://acme.com",
      industry: "Software",
      employees: 500,
      owner: { id: 1, name: "Adi Sharma", email: "adi@mordor.com" },
    },
    contacts: [makeContact()],
    deals: [makeDeal()],
    recentActivity: [],
    lastContactDate: null,
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

async function importDossierFreshsales() {
  const mod = await import("@/components/navigator/dossier/DossierFreshsales");
  return mod.DossierFreshsales;
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: enabled, all features on
  mockFreshsalesSettings = {};
  mockIsAdmin = false;
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DossierFreshsales — CRM Callout & Warmth Bar", () => {
  it("returns null when settings.enabled is false", async () => {
    mockFreshsalesSettings = { enabled: false };
    const DossierFreshsales = await importDossierFreshsales();
    const { container } = render(
      <DossierFreshsales company={makeCompany()} />
    );

    // Component returns null — nothing rendered
    expect(container.innerHTML).toBe("");
  });

  it("shows simple badge when status is 'none' and no intel", async () => {
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "none", freshsalesIntel: null })}
      />
    );

    // Should show the status label (default for none: "Not in CRM")
    expect(screen.getByText("Not in CRM")).toBeInTheDocument();
    // MissingData component should also be shown
    expect(screen.getByTestId("missing-data")).toBeInTheDocument();
  });

  it("shows CRM callout card when status is not 'none' and intel exists", async () => {
    const intel = makeIntel();
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "contacted", freshsalesIntel: intel })}
      />
    );

    // Should show status label "Contacted" (from defaultFreshsalesSettings.statusLabels)
    expect(screen.getByText("Contacted")).toBeInTheDocument();
    // Should NOT show fallback badge
    expect(screen.queryByText("Not in CRM")).not.toBeInTheDocument();
  });

  it("callout card displays status label and owner name", async () => {
    const intel = makeIntel({
      account: {
        id: 42,
        name: "Acme Corporation",
        website: null,
        industry: "Software",
        employees: 500,
        owner: { id: 1, name: "Satish Boini", email: "satish@mordor.com" },
      },
    });
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "negotiation", freshsalesIntel: intel })}
      />
    );

    // Status label for "negotiation" defaults to "Deal in Progress"
    expect(screen.getByText("Deal in Progress")).toBeInTheDocument();
    // Owner name is displayed
    expect(screen.getByText(/Owner: Satish Boini/)).toBeInTheDocument();
  });

  it("callout card shows deal count and contact count", async () => {
    const intel = makeIntel({
      deals: [makeDeal({ id: 1 }), makeDeal({ id: 2, name: "Second Deal" })],
      contacts: [
        makeContact({ id: "c1" }),
        makeContact({ id: "c2", firstName: "Bob" }),
        makeContact({ id: "c3", firstName: "Carol" }),
      ],
    });
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "contacted", freshsalesIntel: intel })}
      />
    );

    expect(screen.getByText("2 deals")).toBeInTheDocument();
    expect(screen.getByText("3 contacts")).toBeInTheDocument();
  });

  it("top deal shows name, stage, and formatted amount ($150K)", async () => {
    const intel = makeIntel({
      deals: [makeDeal({ name: "Platform License", stage: "Closing", amount: 150000 })],
    });
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "negotiation", freshsalesIntel: intel })}
      />
    );

    // Deal name appears in callout card and in deals list section — both are correct
    const dealNames = screen.getAllByText("Platform License");
    expect(dealNames.length).toBeGreaterThanOrEqual(1);
    // Closing stage appears in both locations too
    const stages = screen.getAllByText("Closing");
    expect(stages.length).toBeGreaterThanOrEqual(1);
    // 150000 / 1000 = 150, formatted as "$150K" in callout; "$150,000" in deals list (formatCurrency)
    expect(screen.getByText("$150K")).toBeInTheDocument();
  });

  it("deal amount below $1000 shows raw dollar value in callout", async () => {
    const intel = makeIntel({
      deals: [makeDeal({ name: "Small Deal", stage: "Demo", amount: 500 })],
    });
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "new_lead", freshsalesIntel: intel })}
      />
    );

    // In the callout card: amount < 1000 renders as "$500"
    // In the deals list section: formatCurrency(500) renders as "$500" too
    // Both should be present
    const amounts = screen.getAllByText("$500");
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it("deal with $1.5M amount shows $1500K", async () => {
    const intel = makeIntel({
      deals: [makeDeal({ name: "Big Deal", stage: "Enterprise", amount: 1500000 })],
    });
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "negotiation", freshsalesIntel: intel })}
      />
    );

    // 1500000 / 1000 = 1500, formatted as "$1500K"
    expect(screen.getByText("$1500K")).toBeInTheDocument();
  });

  it("stalled deal shows red warning when daysInStage > threshold", async () => {
    const intel = makeIntel({
      deals: [makeDeal({ name: "Stuck Deal", daysInStage: 45 })],
    });
    // Default stalledDealThresholdDays is 30
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "negotiation", freshsalesIntel: intel })}
      />
    );

    expect(screen.getByText("Stalled (45d)")).toBeInTheDocument();
  });

  it("warmth bar uses amber (#c9a227) when lastContact <= 14 days", async () => {
    // Set last contact to 5 days ago
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    const intel = makeIntel({
      lastContactDate: recentDate.toISOString(),
    });
    const DossierFreshsales = await importDossierFreshsales();
    const { container } = render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "contacted", freshsalesIntel: intel })}
      />
    );

    // Find the warmth bar inner div (child of the bg-surface-2 container)
    const warmthBar = container.querySelector(".h-1.rounded-full.bg-surface-2 > div");
    expect(warmthBar).not.toBeNull();
    const style = (warmthBar as HTMLElement).style;
    // jsdom converts hex to rgb format
    expect(style.backgroundColor).toBe("rgb(201, 162, 39)");
  });

  it("warmth bar uses teal (#67b5c4) when lastContact <= 60 days", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const intel = makeIntel({
      lastContactDate: pastDate.toISOString(),
    });
    const DossierFreshsales = await importDossierFreshsales();
    const { container } = render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "contacted", freshsalesIntel: intel })}
      />
    );

    const warmthBar = container.querySelector(".h-1.rounded-full.bg-surface-2 > div");
    expect(warmthBar).not.toBeNull();
    const style = (warmthBar as HTMLElement).style;
    expect(style.backgroundColor).toBe("rgb(103, 181, 196)");
  });

  it("warmth bar uses gray (#6b6b80) when lastContact > 60 days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 90);
    const intel = makeIntel({
      lastContactDate: oldDate.toISOString(),
    });
    const DossierFreshsales = await importDossierFreshsales();
    const { container } = render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "contacted", freshsalesIntel: intel })}
      />
    );

    const warmthBar = container.querySelector(".h-1.rounded-full.bg-surface-2 > div");
    expect(warmthBar).not.toBeNull();
    const style = (warmthBar as HTMLElement).style;
    expect(style.backgroundColor).toBe("rgb(107, 107, 128)");
  });

  it("warmth bar width = max(5, 100-daysAgo)%", async () => {
    // 20 days ago -> width = max(5, 100-20) = 80%
    const date20 = new Date();
    date20.setDate(date20.getDate() - 20);
    const intel = makeIntel({ lastContactDate: date20.toISOString() });
    const DossierFreshsales = await importDossierFreshsales();
    const { container } = render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "contacted", freshsalesIntel: intel })}
      />
    );

    const warmthBar = container.querySelector(".h-1.rounded-full.bg-surface-2 > div");
    expect(warmthBar).not.toBeNull();
    const style = (warmthBar as HTMLElement).style;
    expect(style.width).toBe("80%");
  });

  it("deal with null amount shows dash in the deals list", async () => {
    const intel = makeIntel({
      deals: [makeDeal({ name: "No Amount Deal", amount: null })],
    });
    const DossierFreshsales = await importDossierFreshsales();
    render(
      <DossierFreshsales
        company={makeCompany({ freshsalesStatus: "new_lead", freshsalesIntel: intel })}
      />
    );

    // In the callout card, deal amount with null should not render (conditional render)
    // But in the deals list below, formatCurrency returns "\u2014" for null
    // The deals section below the callout also shows a dash for null amount
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThan(0);
  });
});
