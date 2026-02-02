"use client";

import { cn } from "@/lib/cn";

interface IcpScoreBadgeProps {
  score: number;
  className?: string;
}

function getScoreStyle(score: number): string {
  if (score >= 80) return "bg-accent-highlight-light text-accent-highlight border-accent-highlight/20";
  if (score >= 60) return "bg-accent-primary-light text-accent-primary border-accent-primary/20";
  if (score >= 40) return "bg-warning-light text-warning border-warning/20";
  return "bg-surface-2 text-text-tertiary border-surface-3";
}

export function IcpScoreBadge({ score, className }: IcpScoreBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge border px-1.5 py-0.5 font-mono text-xs font-semibold",
        getScoreStyle(score),
        className
      )}
    >
      {score}
    </span>
  );
}
