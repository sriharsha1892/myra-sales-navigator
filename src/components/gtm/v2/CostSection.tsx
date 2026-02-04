"use client";

import { useState } from "react";
import { DeltaBadge } from "./DeltaBadge";
import type { GtmEntry, CostItem } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";

interface CostSectionProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

export function CostSection({ latest, previous }: CostSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const costItems: CostItem[] = latest.orgSnapshot?.costItems ?? [];
  const totalCost = latest.totalCostUsd;
  const totalUsers = costItems.reduce((s, it) => s + (it.users || 0), 0);

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <h3 className="text-sm font-semibold text-gray-900">Cost Economics</h3>
        <svg
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform duration-[180ms]",
            expanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Total cost banner */}
          <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl text-white">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Total Cost{latest.costPeriod ? ` — ${latest.costPeriod}` : ""}
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold font-mono tabular-nums">
                ${totalCost.toLocaleString()}
              </span>
              {previous && (
                <DeltaBadge
                  current={totalCost}
                  previous={previous.totalCostUsd}
                  invert
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {costItems.length} items &middot; {totalUsers} users
            </p>
          </div>

          {/* Cost items table */}
          {costItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">
                      Company
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">
                      Cost
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">
                      Users
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {costItems
                    .slice()
                    .sort((a, b) => b.costUsd - a.costUsd)
                    .map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 hover:bg-gray-50/50"
                      >
                        <td className="px-3 py-2 text-gray-900 font-medium">
                          {item.name}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-700">
                          ${item.costUsd.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-700">
                          {item.users}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {costItems.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-4">
              No cost items recorded
            </p>
          )}
        </div>
      )}
    </div>
  );
}
