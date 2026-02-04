"use client";

import { useMemo } from "react";
import { DeltaBadge } from "./DeltaBadge";
import { HoverTooltip } from "@/components/gtm-dashboard/HoverTooltip";
import type { GtmEntry, GtmV2Segment } from "@/lib/gtm/v2-types";
import { SEGMENT_LABELS } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";

interface PipelineSectionProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

const TILE_SEGMENTS: GtmV2Segment[] = [
  "paying", "prospect", "trial", "post_demo",
  "demo_queued", "dormant", "lost", "early",
];

const TILE_BG: Record<GtmV2Segment, string> = {
  paying: "bg-emerald-50 border-emerald-200",
  prospect: "bg-blue-50 border-blue-200",
  trial: "bg-purple-50 border-purple-200",
  post_demo: "bg-amber-50 border-amber-200",
  demo_queued: "bg-orange-50 border-orange-200",
  dormant: "bg-gray-100 border-gray-200",
  lost: "bg-red-50 border-red-200",
  early: "bg-gray-50 border-gray-200",
};

const TILE_TEXT: Record<GtmV2Segment, string> = {
  paying: "text-emerald-700",
  prospect: "text-blue-700",
  trial: "text-purple-700",
  post_demo: "text-amber-700",
  demo_queued: "text-orange-700",
  dormant: "text-gray-600",
  lost: "text-red-600",
  early: "text-gray-500",
};

const MAX_VISIBLE_NAMES = 4;

export function PipelineSection({ latest, previous }: PipelineSectionProps) {
  const snap = latest.orgSnapshot;
  const prevSnap = previous?.orgSnapshot;

  const tiles = useMemo(() => {
    return TILE_SEGMENTS.map((seg) => {
      const count = snap?.counts?.[seg] ?? 0;
      const prev = prevSnap?.counts?.[seg] ?? 0;
      const names: string[] = snap?.names?.[seg] ?? [];
      return { seg, count, prev, names };
    }).filter((t) => t.count > 0 || t.prev > 0);
  }, [snap, prevSnap]);

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Pipeline Overview</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
        {tiles.map(({ seg, count, prev, names }) => {
          const visibleNames = names.slice(0, MAX_VISIBLE_NAMES);
          const overflow = names.length - MAX_VISIBLE_NAMES;

          return (
            <HoverTooltip
              key={seg}
              content={names.length > 0 ? names.join("\n") : "No organizations"}
            >
              <div
                className={cn(
                  "rounded-xl border p-2.5 transition-all duration-[180ms] cursor-default",
                  TILE_BG[seg]
                )}
              >
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                  {SEGMENT_LABELS[seg]}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("text-xl font-semibold font-mono tabular-nums", TILE_TEXT[seg])}>
                    {count}
                  </span>
                  <DeltaBadge current={count} previous={prev} />
                </div>
                {visibleNames.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {visibleNames.map((name) => (
                      <p key={name} className="text-[10px] text-gray-600 truncate leading-tight">
                        {name}
                      </p>
                    ))}
                    {overflow > 0 && (
                      <p className="text-[9px] text-gray-400 font-medium">
                        +{overflow} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </HoverTooltip>
          );
        })}
      </div>
    </div>
  );
}
