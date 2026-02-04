"use client";

import { useState, useMemo } from "react";
import { DeltaBadge } from "./DeltaBadge";
import { HoverTooltip } from "@/components/gtm-dashboard/HoverTooltip";
import type { GtmEntry, GtmV2Segment } from "@/lib/gtm/v2-types";
import { SEGMENT_LABELS, SEGMENT_COLORS } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";

interface PipelineSectionProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

const PIPELINE_GROUPS: { title: string; segments: GtmV2Segment[] }[] = [
  { title: "Product Engagement", segments: ["trial"] },
  { title: "Sales Pipeline", segments: ["post_demo", "demo_queued"] },
  { title: "Inactive", segments: ["dormant", "lost", "early"] },
];

export function PipelineSection({ latest, previous }: PipelineSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const snap = latest.orgSnapshot;
  const prevSnap = previous?.orgSnapshot;

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <h3 className="text-sm font-semibold text-gray-900">Pipeline Overview</h3>
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
        <div className="px-5 pb-5 space-y-5">
          {PIPELINE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.segments.map((seg) => {
                  const count = snap?.counts?.[seg] ?? 0;
                  const prev = prevSnap?.counts?.[seg] ?? 0;
                  const names = snap?.names?.[seg] ?? [];
                  return (
                    <HoverTooltip
                      key={seg}
                      content={
                        names.length > 0
                          ? names.join("\n")
                          : "No organizations"
                      }
                    >
                      <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50/80 transition-colors cursor-default">
                        <span className="text-sm text-gray-700">
                          {SEGMENT_LABELS[seg]}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 font-mono tabular-nums">
                            {count}
                          </span>
                          <DeltaBadge current={count} previous={prev} />
                        </div>
                      </div>
                    </HoverTooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
