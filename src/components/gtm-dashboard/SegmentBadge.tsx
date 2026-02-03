"use client";

import { cn } from "@/lib/cn";
import type { Segment } from "@/lib/gtm-dashboard/types";

const SEGMENT_COLORS: Record<Segment, string> = {
  Paying: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Strong Prospect": "bg-blue-50 text-blue-700 border-blue-200",
  "Active Trial": "bg-purple-50 text-purple-700 border-purple-200",
  "Post-Demo": "bg-amber-50 text-amber-700 border-amber-200",
  "Demo Queued": "bg-cyan-50 text-cyan-700 border-cyan-200",
  Dormant: "bg-gray-50 text-gray-500 border-gray-200",
  Lost: "bg-red-50 text-red-600 border-red-200",
  "Early/No Info": "bg-slate-50 text-slate-500 border-slate-200",
};

interface SegmentBadgeProps {
  segment: Segment;
  className?: string;
}

export function SegmentBadge({ segment, className }: SegmentBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border",
        SEGMENT_COLORS[segment],
        className
      )}
    >
      {segment}
    </span>
  );
}

export { SEGMENT_COLORS };
