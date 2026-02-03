"use client";

import { cn } from "@/lib/cn";

interface DeltaBadgeProps {
  current: number;
  previous: number;
  suffix?: string;
  invert?: boolean;
}

export function DeltaBadge({
  current,
  previous,
  suffix = "",
  invert = false,
}: DeltaBadgeProps) {
  const delta = current - previous;
  if (delta === 0) return null;

  const isPositive = invert ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "\u2191" : "\u2193";
  const absVal = Math.abs(delta);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md",
        isPositive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      )}
    >
      {arrow}
      {absVal}
      {suffix}
    </span>
  );
}
