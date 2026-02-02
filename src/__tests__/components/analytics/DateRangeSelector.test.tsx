import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangeSelector } from "@/components/admin/analytics/DateRangeSelector";

const NOW = new Date("2026-02-01T12:00:00Z");

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return toISO(d);
}

describe("DateRangeSelector", () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ======================== Rendering ========================================

  describe("rendering", () => {
    it("renders 5 buttons: 7d, 14d, 30d, 90d, Custom", () => {
      render(
        <DateRangeSelector
          value={{ from: daysAgo(7), to: toISO(NOW) }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText("7d")).toBeInTheDocument();
      expect(screen.getByText("14d")).toBeInTheDocument();
      expect(screen.getByText("30d")).toBeInTheDocument();
      expect(screen.getByText("90d")).toBeInTheDocument();
      expect(screen.getByText("Custom")).toBeInTheDocument();
    });

    it("highlights correct preset based on initial value", () => {
      render(
        <DateRangeSelector
          value={{ from: daysAgo(30), to: toISO(NOW) }}
          onChange={vi.fn()}
        />
      );
      const btn30 = screen.getByText("30d");
      // Active preset has accent-primary bg class
      expect(btn30.className).toContain("bg-accent-primary");
      // Others do not
      expect(screen.getByText("7d").className).not.toContain("bg-accent-primary");
    });

    it("falls back to Custom mode when value doesn't match any preset", () => {
      render(
        <DateRangeSelector
          value={{ from: "2026-01-01", to: "2026-01-15" }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText("Custom").className).toContain("bg-accent-primary");
    });

    it("no date inputs visible in preset mode", () => {
      render(
        <DateRangeSelector
          value={{ from: daysAgo(7), to: toISO(NOW) }}
          onChange={vi.fn()}
        />
      );
      expect(screen.queryByDisplayValue(daysAgo(7))).toBeNull();
      expect(screen.queryByText("Apply")).toBeNull();
    });
  });

  // ======================== Preset clicks ====================================

  describe("preset clicks", () => {
    it("clicking 7d calls onChange with correct range", () => {
      const onChange = vi.fn();
      render(
        <DateRangeSelector
          value={{ from: daysAgo(30), to: toISO(NOW) }}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByText("7d"));
      expect(onChange).toHaveBeenCalledWith({
        from: daysAgo(7),
        to: toISO(NOW),
      });
    });

    it("clicking 30d calls onChange with correct range", () => {
      const onChange = vi.fn();
      render(
        <DateRangeSelector
          value={{ from: daysAgo(7), to: toISO(NOW) }}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByText("30d"));
      expect(onChange).toHaveBeenCalledWith({
        from: daysAgo(30),
        to: toISO(NOW),
      });
    });

    it("clicking 90d calls onChange with correct range", () => {
      const onChange = vi.fn();
      render(
        <DateRangeSelector
          value={{ from: daysAgo(7), to: toISO(NOW) }}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByText("90d"));
      expect(onChange).toHaveBeenCalledWith({
        from: daysAgo(90),
        to: toISO(NOW),
      });
    });
  });

  // ======================== Custom mode ======================================

  describe("custom mode", () => {
    it("clicking Custom shows date inputs and Apply button", () => {
      render(
        <DateRangeSelector
          value={{ from: daysAgo(7), to: toISO(NOW) }}
          onChange={vi.fn()}
        />
      );
      fireEvent.click(screen.getByText("Custom"));
      expect(screen.getByText("Apply")).toBeInTheDocument();
      // Two date inputs should exist
      const dateInputs = screen.getAllByDisplayValue(/.*/);
      const dateTypeInputs = dateInputs.filter(
        (el) => (el as HTMLInputElement).type === "date"
      );
      expect(dateTypeInputs.length).toBe(2);
    });

    it("changing dates + clicking Apply calls onChange", () => {
      const onChange = vi.fn();
      render(
        <DateRangeSelector
          value={{ from: "2026-01-01", to: "2026-01-15" }}
          onChange={onChange}
        />
      );
      // Already in custom mode because value doesn't match preset
      const dateInputs = screen
        .getAllByDisplayValue(/.*/)
        .filter(
          (el) => (el as HTMLInputElement).type === "date"
        );
      fireEvent.change(dateInputs[0], { target: { value: "2026-01-05" } });
      fireEvent.change(dateInputs[1], { target: { value: "2026-01-10" } });
      fireEvent.click(screen.getByText("Apply"));
      expect(onChange).toHaveBeenCalledWith({
        from: "2026-01-05",
        to: "2026-01-10",
      });
    });

    it("Apply disabled when from > to", () => {
      render(
        <DateRangeSelector
          value={{ from: "2026-01-01", to: "2026-01-15" }}
          onChange={vi.fn()}
        />
      );
      const dateInputs = screen
        .getAllByDisplayValue(/.*/)
        .filter(
          (el) => (el as HTMLInputElement).type === "date"
        );
      // Set from after to
      fireEvent.change(dateInputs[0], { target: { value: "2026-01-20" } });
      fireEvent.change(dateInputs[1], { target: { value: "2026-01-10" } });
      expect(screen.getByText("Apply")).toBeDisabled();
    });

    it("Apply enabled when from === to", () => {
      render(
        <DateRangeSelector
          value={{ from: "2026-01-01", to: "2026-01-15" }}
          onChange={vi.fn()}
        />
      );
      const dateInputs = screen
        .getAllByDisplayValue(/.*/)
        .filter(
          (el) => (el as HTMLInputElement).type === "date"
        );
      fireEvent.change(dateInputs[0], { target: { value: "2026-01-10" } });
      fireEvent.change(dateInputs[1], { target: { value: "2026-01-10" } });
      expect(screen.getByText("Apply")).not.toBeDisabled();
    });
  });
});
