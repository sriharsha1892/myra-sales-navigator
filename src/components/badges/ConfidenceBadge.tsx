"use client";

import { cn } from "@/lib/cn";
import type { ConfidenceLevel } from "@/lib/types";

const colorMap: Record<ConfidenceLevel, string> = {
  high: "bg-confidence-high",
  medium: "bg-confidence-medium",
  low: "bg-confidence-low",
  none: "bg-confidence-none",
};

const labelMap: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  none: "Unverified",
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  score?: number;
  className?: string;
}

export function ConfidenceBadge({ level, score, className }: ConfidenceBadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={`${labelMap[level]}${score != null ? ` (${score}%)` : ""}`}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", colorMap[level])} />
      {score != null && (
        <span className="font-mono text-xs text-text-tertiary">{score}%</span>
      )}
    </span>
  );
}
