"use client";

import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/gtm/format";

interface DeltaBadgeProps {
  current: number;
  previous: number;
  invert?: boolean;
  /** Optional prefix like "$" — when set, formats delta as whole-dollar amount */
  prefix?: string;
}

export function DeltaBadge({ current, previous, invert = false, prefix }: DeltaBadgeProps) {
  const delta = current - previous;
  if (delta === 0) {
    return (
      <span className="text-[10px] text-gray-400 font-mono">&mdash;</span>
    );
  }

  const isPositive = invert ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "\u2191" : "\u2193";
  const absVal = Math.abs(delta);
  const display = prefix === "$" ? formatUsd(absVal).slice(1) : absVal.toLocaleString("en-US");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md tabular-nums",
        isPositive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-600"
      )}
    >
      {arrow}{prefix === "$" ? "$" : ""}{display}
    </span>
  );
}
