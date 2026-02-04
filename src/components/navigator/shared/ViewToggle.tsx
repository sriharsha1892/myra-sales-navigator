"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { ViewMode } from "@/lib/navigator/types";

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
  const companiesRef = useRef<HTMLButtonElement>(null);
  const contactsRef = useRef<HTMLButtonElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const activeRef = isContacts ? contactsRef : companiesRef;
    if (activeRef.current) {
      const el = activeRef.current;
      const parent = el.parentElement;
      if (parent) {
        setUnderline({
          left: el.offsetLeft,
          width: el.offsetWidth,
        });
      }
    }
  }, [isContacts]);

  return (
    <div className="relative flex items-center gap-0">
      <button
        ref={companiesRef}
        onClick={() => onChange("companies")}
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-all duration-200",
          !isContacts
            ? "font-semibold text-text-primary"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        Companies
        {companyCount > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
            {companyCount}
          </span>
        )}
      </button>

      {/* Thin vertical divider */}
      <div className="h-3.5 w-px bg-surface-3" />

      <button
        ref={contactsRef}
        onClick={() => onChange("contacts")}
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-all duration-200",
          isContacts
            ? "font-semibold text-text-primary"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        Contacts
        {(contactCount > 0 || (selectedCompanyContactCount != null && selectedCompanyContactCount > 0)) && (
          <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
            {selectedCompanyContactCount != null ? selectedCompanyContactCount : contactCount}
          </span>
        )}
      </button>

      {/* Sliding underline */}
      <div
        className="absolute bottom-0 h-[2px] bg-accent-secondary transition-all duration-200 ease-out"
        style={{
          left: underline.left,
          width: underline.width,
        }}
      />
    </div>
  );
}
