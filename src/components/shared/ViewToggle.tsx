"use client";

import { cn } from "@/lib/cn";
import type { ViewMode } from "@/lib/types";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  companyCount?: number;
  contactCount?: number;
  selectedCompanyContactCount?: number;
  selectedCompanyName?: string;
}

export function ViewToggle({ value, onChange, companyCount = 0, contactCount = 0, selectedCompanyContactCount, selectedCompanyName }: ViewToggleProps) {
  const isContacts = value === "contacts";

  return (
    <div className="inline-flex rounded-input border border-surface-3 bg-surface-2 p-0.5">
      <button
        onClick={() => onChange("companies")}
        className={cn(
          "flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-sm font-medium transition-all duration-200",
          !isContacts
            ? "bg-accent-primary text-text-inverse"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        Companies
        {companyCount > 0 && (
          <span
            className={cn(
              "font-mono text-[10px] tabular-nums",
              !isContacts ? "text-text-inverse/70" : "text-text-tertiary"
            )}
          >
            {companyCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onChange("contacts")}
        className={cn(
          "flex items-center gap-1.5 rounded-[6px] px-3 py-1 text-sm font-medium transition-all duration-200",
          isContacts
            ? "bg-accent-primary text-text-inverse"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        Contacts
        {(contactCount > 0 || (selectedCompanyContactCount != null && selectedCompanyContactCount > 0)) && (
          <span
            className={cn(
              "font-mono text-[10px] tabular-nums",
              isContacts ? "text-text-inverse/70" : "text-text-tertiary"
            )}
          >
            {selectedCompanyContactCount != null ? selectedCompanyContactCount : contactCount}
          </span>
        )}
      </button>
    </div>
  );
}
