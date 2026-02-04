"use client";

import { cn } from "@/lib/cn";

interface DeltaBadgeProps {
  current: number;
  previous: number;
  invert?: boolean;
}

export function DeltaBadge({ current, previous, invert = false }: DeltaBadgeProps) {
  const delta = current - previous;
  if (delta === 0) {
    return (
      <span className="text-[10px] text-gray-400 font-mono">—</span>
    );
  }

  const isPositive = invert ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "↑" : "↓";
  const absVal = Math.abs(delta);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md tabular-nums",
        isPositive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      )}
    >
      {arrow}{absVal}
    </span>
  );
}
