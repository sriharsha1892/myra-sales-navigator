"use client";

import { cn } from "@/lib/cn";
import type { ViewMode } from "@/lib/types";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-input border border-surface-3 bg-surface-2 p-0.5">
      <ToggleButton
        active={value === "companies"}
        onClick={() => onChange("companies")}
        label="Companies"
      />
      <ToggleButton
        active={value === "contacts"}
        onClick={() => onChange("contacts")}
        label="Contacts"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-[6px] px-3 py-1 text-sm font-medium transition-all duration-[var(--transition-default)]",
        active
          ? "bg-surface-1 text-text-primary shadow-sm"
          : "text-text-tertiary hover:text-text-secondary"
      )}
    >
      {label}
    </button>
  );
}
