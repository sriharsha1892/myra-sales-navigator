"use client";

import { useEffect, useRef } from "react";
import type { RelevanceFeedbackReason } from "@/lib/navigator/types";

interface RelevanceFeedbackPopoverProps {
  domain: string;
  onSelect: (reason: RelevanceFeedbackReason) => void;
  onClose: () => void;
}

const REASONS: { value: RelevanceFeedbackReason; label: string }[] = [
  { value: "wrong_industry", label: "Wrong industry" },
  { value: "wrong_region", label: "Wrong region" },
  { value: "wrong_size", label: "Too small/large" },
  { value: "no_actionable_contacts", label: "No contacts" },
  { value: "irrelevant_signals", label: "Stale signals" },
];

export function RelevanceFeedbackPopover({
  domain,
  onSelect,
  onClose,
}: RelevanceFeedbackPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 rounded-card border border-surface-3 bg-surface-1 p-2 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-1.5 text-[10px] font-medium text-text-tertiary">Why not relevant?</p>
      <div className="flex flex-wrap gap-1">
        {REASONS.map((r) => (
          <button
            key={r.value}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(r.value);
            }}
            className="rounded-pill px-2 py-1 text-xs bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary transition-all duration-[180ms]"
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
