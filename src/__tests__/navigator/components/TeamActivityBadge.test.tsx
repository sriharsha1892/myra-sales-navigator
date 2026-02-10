import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TeamActivityBadge } from "@/components/navigator/badges/TeamActivityBadge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Activity = {
  viewers: { user: string; at: string }[];
  exporters: { user: string; at: string; count: number }[];
  decisions: { user: string; decision: string; at: string }[];
};

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    viewers: [],
    exporters: [],
    decisions: [],
    ...overrides,
  };
}

/** Returns an ISO string N days before now. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

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

describe("TeamActivityBadge", () => {
  // -----------------------------------------------------------------------
  // Renders nothing when no activity users
  // -----------------------------------------------------------------------

  it("renders nothing when all activity arrays are empty", () => {
    const { container } = render(
      <TeamActivityBadge activity={makeActivity()} />
    );
    // Component returns null when users.length === 0
    expect(container.innerHTML).toBe("");
  });

  // -----------------------------------------------------------------------
  // Shows initials for single viewer
  // -----------------------------------------------------------------------

  it("shows initials for a single viewer", () => {
    const activity = makeActivity({
      viewers: [{ user: "Satish Boini", at: daysAgo(0) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    expect(screen.getByText("SB")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Multi-word name → first + last initials
  // -----------------------------------------------------------------------

  it("multi-word name uses first + last initial (e.g., 'Satish Boini' -> 'SB')", () => {
    const activity = makeActivity({
      viewers: [{ user: "Satish Boini", at: daysAgo(0) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    expect(screen.getByText("SB")).toBeInTheDocument();
  });

  it("three-word name uses first + last initial (e.g., 'Mary Jane Watson' -> 'MW')", () => {
    const activity = makeActivity({
      viewers: [{ user: "Mary Jane Watson", at: daysAgo(0) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    expect(screen.getByText("MW")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Single-word name → first 2 chars
  // -----------------------------------------------------------------------

  it("single-word name uses first 2 chars uppercased (e.g., 'Adi' -> 'AD')", () => {
    const activity = makeActivity({
      viewers: [{ user: "Adi", at: daysAgo(0) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    expect(screen.getByText("AD")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Color mapping: export=amber, interested=green, pass=red, default=gray
  // -----------------------------------------------------------------------

  it("applies amber styling for 'export' activity type", () => {
    const activity = makeActivity({
      exporters: [{ user: "Satish", at: daysAgo(0), count: 3 }],
    });

    render(<TeamActivityBadge activity={activity} />);

    const badge = screen.getByText("SA").closest("div");
    expect(badge?.className).toContain("bg-[#d4a012]/20");
    expect(badge?.className).toContain("text-[#d4a012]");
  });

  it("applies green styling for 'interested' decision type", () => {
    const activity = makeActivity({
      decisions: [{ user: "Nikita", decision: "interested", at: daysAgo(0) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    const badge = screen.getByText("NI").closest("div");
    expect(badge?.className).toContain("bg-success/20");
    expect(badge?.className).toContain("text-success");
  });

  it("applies red styling for 'pass' decision type", () => {
    const activity = makeActivity({
      decisions: [{ user: "Nikita", decision: "pass", at: daysAgo(0) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    const badge = screen.getByText("NI").closest("div");
    expect(badge?.className).toContain("bg-danger/20");
    expect(badge?.className).toContain("text-danger");
  });

  it("applies gray/default styling for 'view' activity type", () => {
    const activity = makeActivity({
      viewers: [{ user: "Adi", at: daysAgo(0) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    const badge = screen.getByText("AD").closest("div");
    expect(badge?.className).toContain("bg-surface-2");
    expect(badge?.className).toContain("text-text-tertiary");
  });

  // -----------------------------------------------------------------------
  // Max 3 avatars displayed, +N overflow badge
  // -----------------------------------------------------------------------

  it("shows max 3 avatar badges plus +N overflow count", () => {
    const activity = makeActivity({
      viewers: [
        { user: "Adi", at: daysAgo(0) },
        { user: "Satish Boini", at: daysAgo(0) },
        { user: "Nikita Manmode", at: daysAgo(1) },
        { user: "Kirandeep Kaur", at: daysAgo(1) },
        { user: "Sudeshana Jain", at: daysAgo(2) },
      ],
    });

    render(<TeamActivityBadge activity={activity} />);

    // 3 avatars rendered
    const wrapper = screen.getByTitle(/Adi/);
    const avatarDivs = wrapper.querySelectorAll(
      "div.rounded-full"
    );
    expect(avatarDivs).toHaveLength(3);

    // +2 overflow — React renders "+{overflow}" as two text nodes
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });

  it("does not show overflow when exactly 3 users", () => {
    const activity = makeActivity({
      viewers: [
        { user: "Adi", at: daysAgo(0) },
        { user: "Satish", at: daysAgo(0) },
        { user: "Nikita", at: daysAgo(1) },
      ],
    });

    render(<TeamActivityBadge activity={activity} />);

    // No overflow text
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Tooltip content includes all users
  // -----------------------------------------------------------------------

  it("tooltip (title attribute) includes all users with actions and time", () => {
    const now = new Date().toISOString();
    const activity = makeActivity({
      viewers: [{ user: "Adi", at: now }],
      exporters: [{ user: "Satish", at: now, count: 5 }],
    });

    render(<TeamActivityBadge activity={activity} />);

    // The component uses title attribute on the wrapper div
    const wrapper = screen.getByTitle(/Adi/);
    const title = wrapper.getAttribute("title") ?? "";

    expect(title).toContain("Adi");
    expect(title).toContain("Satish");
    expect(title).toContain("exported");
  });

  // -----------------------------------------------------------------------
  // "today" vs "1d ago" labels in tooltip
  // -----------------------------------------------------------------------

  it("tooltip shows 'today' for activities from today", () => {
    const now = new Date().toISOString();
    const activity = makeActivity({
      viewers: [{ user: "Adi", at: now }],
    });

    render(<TeamActivityBadge activity={activity} />);

    const wrapper = screen.getByTitle(/Adi/);
    const title = wrapper.getAttribute("title") ?? "";
    expect(title).toContain("today");
  });

  it("tooltip shows '1d ago' for activities from yesterday", () => {
    const activity = makeActivity({
      viewers: [{ user: "Adi", at: daysAgo(1) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    const wrapper = screen.getByTitle(/Adi/);
    const title = wrapper.getAttribute("title") ?? "";
    expect(title).toContain("1d ago");
  });

  it("tooltip shows 'Nd ago' for activities from N days ago", () => {
    const activity = makeActivity({
      viewers: [{ user: "Adi", at: daysAgo(3) }],
    });

    render(<TeamActivityBadge activity={activity} />);

    const wrapper = screen.getByTitle(/Adi/);
    const title = wrapper.getAttribute("title") ?? "";
    expect(title).toContain("3d ago");
  });

  // -----------------------------------------------------------------------
  // Dedup same user across types (Map overwrites)
  // -----------------------------------------------------------------------

  it("deduplicates same user across activity types (Map keeps latest overwrite)", () => {
    // Same user appears as viewer and exporter.
    // The component iterates viewers first, then exporters — exporter entry
    // overwrites the viewer entry in the Map, so only one avatar shows.
    const activity = makeActivity({
      viewers: [{ user: "Satish Boini", at: daysAgo(1) }],
      exporters: [{ user: "Satish Boini", at: daysAgo(0), count: 5 }],
    });

    render(<TeamActivityBadge activity={activity} />);

    // Only one avatar badge for Satish
    const allBadges = screen.getAllByText("SB");
    expect(allBadges).toHaveLength(1);

    // The type should be "export" (exporter overwrites viewer in Map)
    const badge = allBadges[0].closest("div");
    expect(badge?.className).toContain("bg-[#d4a012]/20");
  });
});
