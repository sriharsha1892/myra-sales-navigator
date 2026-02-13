"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { ViewMode } from "@/lib/navigator/types";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  companyCount?: number;
  exportedCount?: number;
  prospectCount?: number;
  allContactsActive?: boolean;
  onAllContactsToggle?: () => void;
}

export function ViewToggle({
  value,
  onChange,
  companyCount = 0,
  exportedCount,
  prospectCount = 0,
  allContactsActive = false,
  onAllContactsToggle,
}: ViewToggleProps) {
  const companiesRef = useRef<HTMLButtonElement>(null);
  const exportedRef = useRef<HTMLButtonElement>(null);
  const prospectRef = useRef<HTMLButtonElement>(null);
  const allContactsRef = useRef<HTMLButtonElement>(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  useEffect(() => {
    // All Contacts is a sub-mode of companies, so it takes priority for the underline
    if (allContactsActive && value === "companies" && allContactsRef.current) {
      const el = allContactsRef.current;
      setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
      return;
    }
    const refMap: Record<ViewMode, React.RefObject<HTMLButtonElement | null>> = {
      companies: companiesRef,
      exported: exportedRef,
      prospect_list: prospectRef,
    };
    const activeRef = refMap[value];
    if (activeRef?.current) {
      const el = activeRef.current;
      setUnderline({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    }
  }, [value, allContactsActive]);

  return (
    <div className="relative flex items-center gap-0">
      <button
        ref={companiesRef}
        onClick={() => onChange("companies")}
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-all duration-200",
          value === "companies" && !allContactsActive
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
        ref={prospectRef}
        onClick={() => onChange("prospect_list")}
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-all duration-200",
          value === "prospect_list"
            ? "font-semibold text-text-primary"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        My List
        {prospectCount > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-accent-secondary">
            {prospectCount}
          </span>
        )}
      </button>

      <div className="h-3.5 w-px bg-surface-3" />

      <button
        ref={allContactsRef}
        onClick={onAllContactsToggle}
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-all duration-200",
          allContactsActive && value === "companies"
            ? "font-semibold text-text-primary"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        All Contacts
      </button>

      <div className="h-3.5 w-px bg-surface-3" />

      <button
        ref={exportedRef}
        onClick={() => onChange("exported")}
        className={cn(
          "relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-all duration-200",
          value === "exported"
            ? "font-semibold text-text-primary"
            : "text-text-tertiary hover:text-text-secondary"
        )}
      >
        Exported
        {exportedCount != null && exportedCount > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
            {exportedCount}
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
