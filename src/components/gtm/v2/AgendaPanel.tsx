"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAgendaItems } from "@/hooks/dashboard/useGtmV2";
import type { GtmEntry, AgendaSection } from "@/lib/gtm/v2-types";
import { AGENDA_SECTIONS } from "@/lib/gtm/v2-types";
import { buildDeltaSummary } from "@/lib/gtm/v2-utils";

interface AgendaPanelProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

const SECTION_COLORS: Record<AgendaSection, string> = {
  escalations: "bg-amber-100 text-amber-800",
  decisions_needed: "bg-red-100 text-red-700",
  action_items: "bg-gray-100 text-gray-700",
  pipeline_updates: "bg-blue-100 text-blue-700",
};

export function AgendaPanel({ latest, previous }: AgendaPanelProps) {
  const { data: items = [] } = useAgendaItems(latest.entryDate);
  const openCount = items.filter((i) => !i.isResolved).length;
  const hasEscalations = items.some((i) => !i.isResolved && i.section === "escalations");
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const isExpanded = expanded !== null ? expanded : openCount <= 5 && openCount > 0;

  const deltaSummary = previous
    ? buildDeltaSummary(latest, previous)
    : null;

  if (items.length === 0 && !deltaSummary) return null;

  const grouped: Record<AgendaSection, typeof items> = {
    pipeline_updates: [],
    action_items: [],
    escalations: [],
    decisions_needed: [],
  };
  for (const item of items) {
    if (grouped[item.section]) {
      grouped[item.section].push(item);
    }
  }

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <h3 className="text-sm font-semibold text-gray-900">Agenda</h3>
        <div className="flex items-center gap-2">
          {openCount > 0 && (
            <span className={cn(
              "text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full",
              hasEscalations ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
            )}>
              {openCount} open
            </span>
          )}
          <svg
            className={cn(
              "w-4 h-4 text-gray-400 transition-transform duration-[180ms]",
              isExpanded && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Delta summary */}
          {deltaSummary && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-medium text-blue-800">
                {deltaSummary}
              </p>
            </div>
          )}

          {/* Sections */}
          {AGENDA_SECTIONS.map(({ key, label }) => {
            const sectionItems = grouped[key];
            if (sectionItems.length === 0) return null;

            return (
              <div key={key}>
                <p className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider mb-2 inline-block px-2 py-0.5 rounded-full",
                  SECTION_COLORS[key]
                )}>
                  {label}
                </p>
                <ul className="space-y-1">
                  {sectionItems.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "text-xs pl-3 py-0.5 relative",
                        item.isResolved
                          ? "text-gray-400 line-through"
                          : "text-gray-700"
                      )}
                    >
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-gray-400" />
                      {item.content}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
