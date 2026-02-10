import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PreCallBriefingCard } from "@/components/navigator/outreach/PreCallBriefingCard";
import type { BriefingData } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBriefingData(overrides?: Partial<BriefingData>): BriefingData {
  return {
    contact: {
      name: "Jane Doe",
      title: "VP of Sales",
      seniority: "vp",
      phone: "+1-555-1234",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      emailConfidence: 85,
    },
    company: {
      name: "Acme Corp",
      domain: "acme.com",
      industry: "Technology",
      employeeCount: 500,
      location: "San Francisco, CA",
      icpScore: 78,
      icpReasoning: "Strong fit: tech company in target size range",
    },
    crm: {
      status: "negotiation",
      warmth: "hot",
      lastContactDate: "2026-01-28T00:00:00Z",
      topDeal: {
        name: "Acme Enterprise Deal",
        stage: "Proposal",
        amount: 75000,
        daysInStage: 25,
      },
      lastActivity: {
        type: "email",
        date: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
        actor: "Satish",
      },
    },
    topSignal: {
      type: "funding",
      title: "Acme raises $50M Series C",
      date: new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days ago
    },
    previousSteps: [
      { channel: "email", completedAt: new Date(Date.now() - 5 * 86400000).toISOString(), outcome: "opened" },
      { channel: "call", completedAt: new Date(Date.now() - 2 * 86400000).toISOString(), outcome: "voicemail" },
    ],
    suggestedOpener: "Saw your Series C news, Jane -- congrats!",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup/teardown
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

// ===========================================================================
// PreCallBriefingCard tests
// ===========================================================================

describe("PreCallBriefingCard", () => {
  // -------------------------------------------------------------------------
  // Loading / empty states
  // -------------------------------------------------------------------------

  it("shows loading skeleton when loading=true", () => {
    const { container } = render(<PreCallBriefingCard loading={true} data={null} />);
    // The skeleton has animate-pulse class
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeTruthy();
    // Should NOT show any contact info
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });

  it("shows loading skeleton when data=null and loading is not set", () => {
    const { container } = render(<PreCallBriefingCard data={null} />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeTruthy();
  });

  it("shows loading skeleton when data=undefined", () => {
    const { container } = render(<PreCallBriefingCard />);
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Contact + company header
  // -------------------------------------------------------------------------

  it("renders contact name and title", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    // Title is rendered with a middot prefix
    expect(screen.getByText(/VP of Sales/)).toBeInTheDocument();
  });

  it("renders company name, industry, employee count", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
    expect(screen.getByText("500 emp")).toBeInTheDocument();
  });

  it("renders ICP reasoning when present", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    expect(screen.getByText(/ICP 78/)).toBeInTheDocument();
    expect(screen.getByText(/Strong fit/)).toBeInTheDocument();
  });

  it("does not render ICP line when icpReasoning is null", () => {
    const data = makeBriefingData({
      company: {
        ...makeBriefingData().company,
        icpReasoning: null,
      },
    });
    render(<PreCallBriefingCard data={data} />);

    expect(screen.queryByText(/ICP/)).not.toBeInTheDocument();
  });

  it("does not render contact title when empty", () => {
    const data = makeBriefingData({
      contact: { ...makeBriefingData().contact, title: "" },
    });
    render(<PreCallBriefingCard data={data} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    // The middot + title span should not be rendered
    const titleSpans = screen.queryAllByText(/VP of Sales/);
    expect(titleSpans).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // CRM status + deal info
  // -------------------------------------------------------------------------

  it("shows CRM status and deal info when present", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    // CRM status shown (underscores replaced with spaces)
    expect(screen.getByText(/CRM: negotiation/)).toBeInTheDocument();
    // Deal name
    expect(screen.getByText("Acme Enterprise Deal")).toBeInTheDocument();
    // Deal amount formatted
    expect(screen.getByText("$75K")).toBeInTheDocument();
  });

  it("hides CRM line when status is 'none'", () => {
    const data = makeBriefingData({
      crm: {
        ...makeBriefingData().crm,
        status: "none",
        topDeal: null,
      },
    });
    render(<PreCallBriefingCard data={data} />);

    expect(screen.queryByText(/CRM:/)).not.toBeInTheDocument();
  });

  it("shows 'Stalled' text when daysInStage > 30", () => {
    const data = makeBriefingData({
      crm: {
        ...makeBriefingData().crm,
        topDeal: {
          name: "Stale Deal",
          stage: "Proposal",
          amount: 50000,
          daysInStage: 45,
        },
      },
    });
    render(<PreCallBriefingCard data={data} />);

    expect(screen.getByText(/Stalled.*45d/)).toBeInTheDocument();
  });

  it("does not show 'Stalled' when daysInStage <= 30", () => {
    const data = makeBriefingData({
      crm: {
        ...makeBriefingData().crm,
        topDeal: {
          name: "Active Deal",
          stage: "Proposal",
          amount: 50000,
          daysInStage: 15,
        },
      },
    });
    render(<PreCallBriefingCard data={data} />);

    expect(screen.queryByText(/Stalled/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Last activity
  // -------------------------------------------------------------------------

  it("shows last activity when present", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    expect(screen.getByText(/Last: email from Satish/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Signal line
  // -------------------------------------------------------------------------

  it("shows signal line when topSignal exists", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    expect(screen.getByText(/Signal: Acme raises \$50M Series C/)).toBeInTheDocument();
  });

  it("hides signal line when topSignal is null", () => {
    const data = makeBriefingData({ topSignal: null });
    render(<PreCallBriefingCard data={data} />);

    expect(screen.queryByText(/Signal:/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Suggested opener
  // -------------------------------------------------------------------------

  it("shows suggested opener in quotes", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    // The component wraps the opener in ldquo/rdquo
    expect(screen.getByText(/Saw your Series C news/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Previous steps timeline
  // -------------------------------------------------------------------------

  it("shows previous steps timeline with channel names", () => {
    render(<PreCallBriefingCard data={makeBriefingData()} />);

    expect(screen.getByText("Previous:")).toBeInTheDocument();
    // Channel names are capitalized
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("call")).toBeInTheDocument();
  });

  it("hides previous steps section when array empty", () => {
    const data = makeBriefingData({ previousSteps: [] });
    render(<PreCallBriefingCard data={data} />);

    expect(screen.queryByText("Previous:")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Warmth dot rendering
  // -------------------------------------------------------------------------

  it("renders hot warmth dot with correct title", () => {
    const data = makeBriefingData({ crm: { ...makeBriefingData().crm, warmth: "hot" } });
    render(<PreCallBriefingCard data={data} />);

    const dot = screen.getByTitle("Hot");
    expect(dot).toBeInTheDocument();
  });

  it("renders cold warmth dot with correct title", () => {
    const data = makeBriefingData({ crm: { ...makeBriefingData().crm, warmth: "cold" } });
    render(<PreCallBriefingCard data={data} />);

    const dot = screen.getByTitle("Cold");
    expect(dot).toBeInTheDocument();
  });

  it("renders warm warmth dot with correct title", () => {
    const data = makeBriefingData({ crm: { ...makeBriefingData().crm, warmth: "warm" } });
    render(<PreCallBriefingCard data={data} />);

    const dot = screen.getByTitle("Warm");
    expect(dot).toBeInTheDocument();
  });
});
