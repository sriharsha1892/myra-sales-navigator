"use client";

import { forwardRef, useImperativeHandle, useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { TypeaheadItem } from "@/hooks/navigator/useTypeahead";
import { CompanyLogo } from "@/components/navigator/shared/CompanyLogo";

export interface SearchTypeaheadHandle {
  handleArrowKey: (direction: "up" | "down") => void;
  hasActiveItem: () => boolean;
  selectActive: () => void;
}

interface SearchTypeaheadProps {
  recentSearches: TypeaheadItem[];
  matchingPresets: TypeaheadItem[];
  matchingCompanies: TypeaheadItem[];
  visible: boolean;
  onSelect: (item: TypeaheadItem) => void;
  onDismiss: () => void;
}

export const SearchTypeahead = forwardRef<SearchTypeaheadHandle, SearchTypeaheadProps>(
  function SearchTypeahead({ recentSearches, matchingPresets, matchingCompanies, visible, onSelect, onDismiss }, ref) {
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Flat list of all items for keyboard navigation
    const allItems = [...recentSearches, ...matchingCompanies, ...matchingPresets];

    // Reset active index when items change
    useEffect(() => {
      setActiveIndex(-1);
    }, [allItems.length]);

    // Scroll active item into view when navigating with arrow keys
    useEffect(() => {
      if (activeIndex < 0) return;
      containerRef.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
    }, [activeIndex]);

    // Click-outside dismissal
    useEffect(() => {
      if (!visible) return;
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onDismiss();
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [visible, onDismiss]);

    const handleArrowKey = useCallback((direction: "up" | "down") => {
      setActiveIndex((prev) => {
        if (direction === "down") {
          return prev < allItems.length - 1 ? prev + 1 : 0;
        }
        return prev > 0 ? prev - 1 : allItems.length - 1;
      });
    }, [allItems.length]);

    const hasActiveItem = useCallback(() => activeIndex >= 0 && activeIndex < allItems.length, [activeIndex, allItems.length]);

    const selectActive = useCallback(() => {
      if (activeIndex >= 0 && activeIndex < allItems.length) {
        onSelect(allItems[activeIndex]);
      }
    }, [activeIndex, allItems, onSelect]);

    useImperativeHandle(ref, () => ({
      handleArrowKey,
      hasActiveItem,
      selectActive,
    }));

    if (!visible || allItems.length === 0) return null;

    const sectionLabel = (label: string) => (
      <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
    );

    let flatIdx = 0;

    return (
      <div
        ref={containerRef}
        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-card border border-surface-3 bg-surface-1/95 backdrop-blur-xl shadow-xl"
      >
        {recentSearches.length > 0 && (
          <>
            {sectionLabel("Recent Searches")}
            {recentSearches.map((item) => {
              const idx = flatIdx++;
              return (
                <TypeaheadRow
                  key={item.id}
                  item={item}
                  isActive={idx === activeIndex}
                  icon={<ClockIcon />}
                  onSelect={() => onSelect(item)}
                  onHover={() => setActiveIndex(idx)}
                />
              );
            })}
          </>
        )}
        {matchingCompanies.length > 0 && (
          <>
            {sectionLabel("Companies")}
            {matchingCompanies.map((item) => {
              const idx = flatIdx++;
              return (
                <TypeaheadRow
                  key={item.id}
                  item={item}
                  isActive={idx === activeIndex}
                  icon={
                    item.company?.domain ? (
                      <CompanyLogo domain={item.company.domain} name={item.company.name ?? item.label} size={14} className="h-3.5 w-3.5" />
                    ) : <CompanyIcon />
                  }
                  onSelect={() => onSelect(item)}
                  onHover={() => setActiveIndex(idx)}
                />
              );
            })}
          </>
        )}
        {matchingPresets.length > 0 && (
          <>
            {sectionLabel("Saved Presets")}
            {matchingPresets.map((item) => {
              const idx = flatIdx++;
              return (
                <TypeaheadRow
                  key={item.id}
                  item={item}
                  isActive={idx === activeIndex}
                  icon={<PresetIcon />}
                  onSelect={() => onSelect(item)}
                  onHover={() => setActiveIndex(idx)}
                />
              );
            })}
          </>
        )}
      </div>
    );
  }
);

function TypeaheadRow({
  item,
  isActive,
  icon,
  onSelect,
  onHover,
}: {
  item: TypeaheadItem;
  isActive: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      data-active={isActive || undefined}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
        isActive ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2/50"
      )}
    >
      <span className="flex-shrink-0 text-text-tertiary">{icon}</span>
      <span className="min-w-0 truncate">{item.label}</span>
      <span className="ml-auto flex-shrink-0 text-[10px] text-text-tertiary">
        {item.type === "recent" ? "" : item.type === "preset" ? "Preset" : item.company?.domain}
      </span>
    </button>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PresetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 7V4a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
    </svg>
  );
}
