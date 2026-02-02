"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  onClear?: () => void;
}

export function FilterSection({ title, children, defaultOpen = true, count, onClear }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-surface-3 py-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-secondary"
      >
        <span className="flex items-center gap-1.5">
          {title}
          {count != null && count > 0 && (
            <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-primary px-1 text-[9px] font-semibold text-text-inverse">
              {count}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {count != null && count > 0 && onClear && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-[9px] font-medium normal-case tracking-normal text-text-tertiary hover:text-accent-primary"
              role="button"
            >
              Clear
            </span>
          )}
          <svg
            className={cn(
              "h-3 w-3 transition-transform duration-[var(--transition-default)]",
              isOpen && "rotate-180"
            )}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </span>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-[var(--transition-default)]",
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 py-2">{children}</div>
      </div>
    </div>
  );
}
