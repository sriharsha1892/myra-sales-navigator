"use client";

import { useMemo } from "react";
import type { GtmEntry, GtmV2Segment } from "@/lib/gtm/v2-types";
import { ALL_V2_SEGMENTS, SEGMENT_LABELS } from "@/lib/gtm/v2-types";
import { computeOrgMovements, formatEntryDate } from "@/lib/gtm/v2-utils";
import { cn } from "@/lib/cn";

const SEG_COLORS: Partial<Record<GtmV2Segment, string>> = {
  paying: "text-emerald-700 bg-emerald-50 border-emerald-200",
  prospect: "text-blue-700 bg-blue-50 border-blue-200",
  trial: "text-purple-700 bg-purple-50 border-purple-200",
  post_demo: "text-amber-700 bg-amber-50 border-amber-200",
  demo_queued: "text-orange-700 bg-orange-50 border-orange-200",
  lost: "text-red-600 bg-red-50 border-red-200",
  dormant: "text-gray-500 bg-gray-100 border-gray-200",
};

interface Props {
  entries: GtmEntry[];
}

interface Movement {
  org: string;
  fromSeg: GtmV2Segment;
  toSeg: GtmV2Segment;
}

export function ConsolidatedMovements({ entries }: Props) {
  // Compute movements between consecutive checkpoints
  const periods = useMemo(() => {
    const result: {
      from: string;
      to: string;
      movements: Movement[];
      newOrgs: { org: string; seg: GtmV2Segment }[];
      lostOrgs: string[];
    }[] = [];

    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      const mvs = computeOrgMovements(curr.orgSnapshot, prev.orgSnapshot);

      const movements: Movement[] = [];
      const newOrgs: { org: string; seg: GtmV2Segment }[] = [];
      const lostOrgs: string[] = [];

      // Track all org names in prev
      const allPrevOrgs = new Set<string>();
      for (const seg of ALL_V2_SEGMENTS) {
        for (const n of (prev.orgSnapshot?.names?.[seg] ?? [])) allPrevOrgs.add(n);
      }

      for (const seg of ALL_V2_SEGMENTS) {
        for (const org of mvs[seg].added) {
          if (!allPrevOrgs.has(org)) {
            newOrgs.push({ org, seg });
          } else {
            // Find which segment they came from
            for (const fromSeg of ALL_V2_SEGMENTS) {
              if (fromSeg !== seg && mvs[fromSeg].removed.includes(org)) {
                movements.push({ org, fromSeg, toSeg: seg });
                break;
              }
            }
          }
        }

        // Check for orgs that moved to "lost"
        if (seg === "lost") {
          for (const org of mvs.lost.added) {
            if (!lostOrgs.includes(org)) lostOrgs.push(org);
          }
        }
      }

      result.push({
        from: prev.entryDate,
        to: curr.entryDate,
        movements,
        newOrgs,
        lostOrgs,
      });
    }

    return result;
  }, [entries]);

  if (entries.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-sm text-gray-500">Need at least 2 checkpoints to show movements.</p>
      </div>
    );
  }

  const hasAnyMovements = periods.some(
    (p) => p.movements.length > 0 || p.newOrgs.length > 0
  );

  return (
    <div className="space-y-5">
      {periods.map((period, pi) => {
        const isEmpty = period.movements.length === 0 && period.newOrgs.length === 0;
        return (
          <div key={pi} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 mb-4">
              Pipeline Movements{" "}
              <span className="font-normal text-gray-500 text-xs">
                {formatEntryDate(period.from)} &rarr; {formatEntryDate(period.to)}
              </span>
            </div>

            {isEmpty ? (
              <div className="text-center py-6 text-sm text-gray-400">
                No movements in this period
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Lost orgs */}
                {period.lostOrgs.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">
                      Moved to Lost
                    </div>
                    <div className="font-mono text-2xl font-semibold text-gray-900 mb-2">
                      {period.lostOrgs.length}
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed">
                      {period.lostOrgs.join(", ")}
                    </div>
                  </div>
                )}

                {/* Segment movements */}
                {period.movements.filter((m) => m.toSeg !== "lost").length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Segment Changes
                    </div>
                    <div className="space-y-2">
                      {period.movements
                        .filter((m) => m.toSeg !== "lost")
                        .map((m, mi) => (
                          <div key={mi} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-900 flex-1 min-w-0 truncate">{m.org}</span>
                            <span className={cn(
                              "text-[9px] font-mono font-medium px-1.5 py-0.5 rounded",
                              "text-gray-500 bg-gray-100"
                            )}>
                              {SEGMENT_LABELS[m.fromSeg]}
                            </span>
                            <span className="text-gray-300">&rarr;</span>
                            <span className={cn(
                              "text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border",
                              SEG_COLORS[m.toSeg] ?? "text-gray-500 bg-gray-50 border-gray-200"
                            )}>
                              {SEGMENT_LABELS[m.toSeg]}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* New orgs */}
                {period.newOrgs.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-2">
                      New Entries
                    </div>
                    <div className="font-mono text-2xl font-semibold text-gray-900 mb-2">
                      {period.newOrgs.length}
                    </div>
                    <div className="space-y-1">
                      {period.newOrgs.map((no, ni) => (
                        <div key={ni} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-700">{no.org}</span>
                          <span className={cn(
                            "text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border",
                            SEG_COLORS[no.seg] ?? "text-gray-500 bg-gray-50 border-gray-200"
                          )}>
                            {SEGMENT_LABELS[no.seg]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
