"use client";

import { useState, useRef } from "react";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  persistKey?: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, count, defaultOpen = false, persistKey, isLoading, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (persistKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(`nav_section_${persistKey}`);
      if (stored !== null) return stored === "1";
    }
    return defaultOpen;
  });

  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (persistKey && typeof window !== "undefined") {
      localStorage.setItem(`nav_section_${persistKey}`, next ? "1" : "0");
    }
  };

  return (
    <div className="border-t border-surface-3">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-hover/30"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`flex-shrink-0 text-text-tertiary transition-transform duration-[180ms] ${isOpen ? "" : "-rotate-90"}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] tabular-nums text-text-tertiary">({count})</span>
        )}
        {isLoading && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-text-tertiary/30 border-t-text-tertiary" />
        )}
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-[180ms] ease-out"
        style={{
          maxHeight: isOpen ? "2000px" : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        {isOpen && children}
      </div>
    </div>
  );
}
