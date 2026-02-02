import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyKpiCards } from "@/components/admin/analytics/WeeklyKpiCards";

const SAMPLE_DATA = {
  exportsThisWeek: 15,
  prospectsDiscovered: 42,
  activeUsers: 5,
  avgIcpScore: 72,
};

describe("WeeklyKpiCards", () => {
  // ======================== Loading ==========================================

  describe("loading", () => {
    it("data=null renders 4 shimmer placeholders", () => {
      const { container } = render(<WeeklyKpiCards data={null} />);
      const shimmers = container.querySelectorAll(".shimmer");
      expect(shimmers).toHaveLength(4);
    });
  });

  // ======================== Data display =====================================

  describe("data display", () => {
    it("renders all 4 KPI values correctly", () => {
      render(<WeeklyKpiCards data={SAMPLE_DATA} />);
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("72")).toBeInTheDocument();
    });

    it("labels correct", () => {
      render(<WeeklyKpiCards data={SAMPLE_DATA} />);
      expect(screen.getByText("Exports This Week")).toBeInTheDocument();
      expect(screen.getByText("Prospects Discovered")).toBeInTheDocument();
      expect(screen.getByText("Active Users")).toBeInTheDocument();
      expect(screen.getByText("Avg ICP Score")).toBeInTheDocument();
    });
  });

  // ======================== Progress bars ====================================

  describe("progress bars", () => {
    it("renders progress bars only on exports + avgIcp cards (2 total)", () => {
      const { container } = render(<WeeklyKpiCards data={SAMPLE_DATA} />);
      // Progress bars have bg-surface-3 as the track
      const tracks = container.querySelectorAll(".bg-surface-3.h-1");
      expect(tracks).toHaveLength(2);
    });

    it("no progress bar on prospectsDiscovered or activeUsers", () => {
      const { container } = render(<WeeklyKpiCards data={SAMPLE_DATA} />);
      // Get all card elements
      const cards = container.querySelectorAll(".rounded-card");
      // Cards[1] = prospects, cards[2] = active users — no progress bar children
      const prospectsCard = cards[1];
      const activeUsersCard = cards[2];
      expect(prospectsCard.querySelector(".h-1")).toBeNull();
      expect(activeUsersCard.querySelector(".h-1")).toBeNull();
    });
  });

  // ======================== Target behavior ==================================

  describe("target behavior", () => {
    it("default targets (20/60) used when targets prop omitted", () => {
      const { container } = render(<WeeklyKpiCards data={SAMPLE_DATA} />);
      // Default targets: 20 for exports, 60 for avgIcp
      // These are rendered as <span> inside the progress bar section
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("60")).toBeInTheDocument();
    });

    it("custom targets used when provided", () => {
      render(
        <WeeklyKpiCards
          data={SAMPLE_DATA}
          targets={{ exportsThisWeek: 50, avgIcpScore: 80 }}
        />
      );
      expect(screen.getByText("50")).toBeInTheDocument();
      expect(screen.getByText("80")).toBeInTheDocument();
    });

    it("green bar when value >= target", () => {
      // avgIcpScore=72, target=60 → at or above target → green
      const { container } = render(
        <WeeklyKpiCards
          data={SAMPLE_DATA}
          targets={{ exportsThisWeek: 10, avgIcpScore: 60 }}
        />
      );
      const greenBars = container.querySelectorAll(".bg-green-500");
      // exports (15 >= 10) + avgIcp (72 >= 60) = 2 green bars
      expect(greenBars).toHaveLength(2);
    });

    it("amber bar when value < target", () => {
      // exports=15, target=50 → below → accent-primary (amber)
      const { container } = render(
        <WeeklyKpiCards
          data={SAMPLE_DATA}
          targets={{ exportsThisWeek: 50, avgIcpScore: 100 }}
        />
      );
      const amberBars = container.querySelectorAll(".bg-accent-primary.h-1");
      expect(amberBars).toHaveLength(2);
    });
  });

  // ======================== Edge cases =======================================

  describe("edge cases", () => {
    it("progress bar width capped at 100% when value > target", () => {
      const { container } = render(
        <WeeklyKpiCards
          data={{ ...SAMPLE_DATA, exportsThisWeek: 100 }}
          targets={{ exportsThisWeek: 20, avgIcpScore: 60 }}
        />
      );
      // Find inner progress bars (the colored fill divs inside the track)
      const tracks = container.querySelectorAll(".bg-surface-3.h-1");
      const firstFill = tracks[0]?.firstElementChild as HTMLElement;
      expect(firstFill.style.width).toBe("100%");
    });

    it("zero target handled (no division by zero)", () => {
      // Should not throw
      expect(() => {
        render(
          <WeeklyKpiCards
            data={SAMPLE_DATA}
            targets={{ exportsThisWeek: 0, avgIcpScore: 0 }}
          />
        );
      }).not.toThrow();
    });

    it("zero data values render without error", () => {
      expect(() => {
        render(
          <WeeklyKpiCards
            data={{
              exportsThisWeek: 0,
              prospectsDiscovered: 0,
              activeUsers: 0,
              avgIcpScore: 0,
            }}
          />
        );
      }).not.toThrow();
      expect(screen.getAllByText("0")).toHaveLength(4);
    });
  });
});
