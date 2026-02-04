"use client";

import { useMemo } from "react";
import { DeltaBadge } from "./DeltaBadge";
import type { GtmEntry, CostItem } from "@/lib/gtm/v2-types";
import { formatUsd } from "@/lib/gtm/format";
import { cn } from "@/lib/cn";

interface CostSectionProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

export function CostSection({ latest, previous }: CostSectionProps) {
  const costItems: CostItem[] = latest.orgSnapshot?.costItems ?? [];
  const totalCost = latest.totalCostUsd;
  const totalUsers = costItems.reduce((s, it) => s + (it.users || 0), 0);

  const sorted = useMemo(
    () => costItems.slice().sort((a, b) => b.costUsd - a.costUsd),
    [costItems]
  );

  const maxCost = sorted.length > 0 ? sorted[0].costUsd : 1;

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Cost Economics</h3>

      {/* Total cost banner */}
      <div className="p-3 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl text-white mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
          Total Cost{latest.costPeriod ? ` \u2014 ${latest.costPeriod}` : ""}
        </p>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold font-mono tabular-nums">
            {formatUsd(totalCost)}
          </span>
          {previous && (
            <DeltaBadge
              current={totalCost}
              previous={previous.totalCostUsd}
              invert
              prefix="$"
            />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {costItems.length} items &middot; {totalUsers} users
        </p>
      </div>

      {/* Horizontal bar chart */}
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.map((item, i) => {
            const pct = maxCost > 0 ? (item.costUsd / maxCost) * 100 : 0;
            const isTop3 = i < 3;
            return (
              <div key={i} className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-xs w-[140px] shrink-0 truncate",
                    isTop3 ? "font-semibold text-gray-900" : "text-gray-600"
                  )}
                >
                  {item.name}
                </span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-[180ms]",
                      isTop3 ? "bg-gray-700" : "bg-gray-400"
                    )}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums shrink-0 w-[72px] text-right",
                    isTop3 ? "font-semibold text-gray-900" : "text-gray-600"
                  )}
                >
                  {formatUsd(item.costUsd)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic text-center py-4">
          No cost items recorded
        </p>
      )}
    </div>
  );
}
