import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KpiTargetEditor } from "@/components/navigator/admin/analytics/KpiTargetEditor";

const DEFAULT_TARGETS = { exportsThisWeek: 20, avgIcpScore: 60 };

describe("KpiTargetEditor", () => {
  // ======================== Rendering ========================================

  describe("rendering", () => {
    it("renders inputs with initial target values", () => {
      render(<KpiTargetEditor targets={DEFAULT_TARGETS} onSave={vi.fn()} />);
      const inputs = screen.getAllByRole("spinbutton");
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toHaveValue(20);
      expect(inputs[1]).toHaveValue(60);
    });

    it("save button hidden when values unchanged", () => {
      render(<KpiTargetEditor targets={DEFAULT_TARGETS} onSave={vi.fn()} />);
      expect(screen.queryByText("Save targets")).toBeNull();
    });
  });

  // ======================== Interactions =====================================

  describe("interactions", () => {
    it("changing exports value shows Save button", () => {
      render(<KpiTargetEditor targets={DEFAULT_TARGETS} onSave={vi.fn()} />);
      const inputs = screen.getAllByRole("spinbutton");
      fireEvent.change(inputs[0], { target: { value: "30" } });
      expect(screen.getByText("Save targets")).toBeInTheDocument();
    });

    it("changing avgIcp value shows Save button", () => {
      render(<KpiTargetEditor targets={DEFAULT_TARGETS} onSave={vi.fn()} />);
      const inputs = screen.getAllByRole("spinbutton");
      fireEvent.change(inputs[1], { target: { value: "75" } });
      expect(screen.getByText("Save targets")).toBeInTheDocument();
    });

    it("reverting to original hides Save button", () => {
      render(<KpiTargetEditor targets={DEFAULT_TARGETS} onSave={vi.fn()} />);
      const inputs = screen.getAllByRole("spinbutton");
      fireEvent.change(inputs[0], { target: { value: "30" } });
      expect(screen.getByText("Save targets")).toBeInTheDocument();
      fireEvent.change(inputs[0], { target: { value: "20" } });
      expect(screen.queryByText("Save targets")).toBeNull();
    });

    it("click Save calls onSave with updated targets", () => {
      const onSave = vi.fn();
      render(<KpiTargetEditor targets={DEFAULT_TARGETS} onSave={onSave} />);
      const inputs = screen.getAllByRole("spinbutton");
      fireEvent.change(inputs[0], { target: { value: "35" } });
      fireEvent.change(inputs[1], { target: { value: "70" } });
      fireEvent.click(screen.getByText("Save targets"));
      expect(onSave).toHaveBeenCalledWith({
        exportsThisWeek: 35,
        avgIcpScore: 70,
      });
    });
  });

  // ======================== Saving state =====================================

  describe("saving state", () => {
    it("saving=true shows 'Saving...' and button is disabled", () => {
      render(
        <KpiTargetEditor
          targets={{ exportsThisWeek: 20, avgIcpScore: 60 }}
          onSave={vi.fn()}
          saving={true}
        />
      );
      // Need to change a value first so the button appears
      const inputs = screen.getAllByRole("spinbutton");
      fireEvent.change(inputs[0], { target: { value: "30" } });
      expect(screen.getByText("Saving...")).toBeInTheDocument();
      expect(screen.getByText("Saving...")).toBeDisabled();
    });
  });
});
