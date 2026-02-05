"use client";

import type { GtmEntry, GtmAgendaItem } from "@/lib/gtm/v2-types";
import { AGENDA_SECTIONS } from "@/lib/gtm/v2-types";
import { formatEntryDate } from "@/lib/gtm/v2-utils";
import { cn } from "@/lib/cn";

const SECTION_COLORS: Record<string, { bullet: string; bg: string; border: string }> = {
  pipeline_updates: { bullet: "bg-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  action_items: { bullet: "bg-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
  escalations: { bullet: "bg-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  decisions_needed: { bullet: "bg-red-500", bg: "bg-red-50", border: "border-red-200" },
};

interface Props {
  entries: GtmEntry[];
  agendaItems: GtmAgendaItem[];
}

export function ConsolidatedAgenda({ entries, agendaItems }: Props) {
  const latestDate = entries.length > 0 ? entries[entries.length - 1].entryDate : "";

  // Group items by section
  const grouped: Record<string, GtmAgendaItem[]> = {};
  for (const section of AGENDA_SECTIONS) {
    grouped[section.key] = agendaItems.filter((item) => item.section === section.key);
  }

  const totalOpen = agendaItems.filter((i) => !i.isResolved).length;

  if (agendaItems.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-sm text-gray-500">No agenda items.</p>
      </div>
    );
  }

  // Render as 3-column grid (like the HTML report)
  const nonEmptySections = AGENDA_SECTIONS.filter((s) => grouped[s.key].length > 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">
            Action Items{" "}
            {latestDate && (
              <span className="font-normal text-gray-500 text-xs">
                Week of {formatEntryDate(latestDate)}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            {totalOpen} open
          </span>
        </div>
      </div>

      <div className={cn(
        "grid gap-3.5",
        nonEmptySections.length >= 3 ? "grid-cols-3" : nonEmptySections.length === 2 ? "grid-cols-2" : "grid-cols-1"
      )}>
        {nonEmptySections.map((section) => {
          const items = grouped[section.key];
          const colors = SECTION_COLORS[section.key] ?? SECTION_COLORS.action_items;
          return (
            <div key={section.key} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className={cn(
                "text-[10px] font-semibold uppercase tracking-wider mb-3 pb-2 border-b",
                colors.border,
                section.key === "escalations" ? "text-amber-700" :
                section.key === "decisions_needed" ? "text-red-600" :
                section.key === "pipeline_updates" ? "text-blue-700" :
                "text-gray-500"
              )}>
                {section.label}
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg border",
                      colors.bg,
                      colors.border,
                      item.isResolved && "opacity-50"
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", colors.bullet)} />
                    <div className="flex-1 text-xs text-gray-700 leading-relaxed">
                      {item.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
