"use client";

import { cn } from "@/lib/cn";
import { HelpTip } from "@/components/shared/HelpTip";

interface IcpScoreBadgeProps {
  score: number;
  className?: string;
  showHelp?: boolean;
}

function getStrokeColor(score: number): string {
  if (score >= 80) return "var(--color-accent-highlight)";
  if (score >= 60) return "var(--color-accent-primary)";
  if (score >= 40) return "var(--color-warning)";
  return "var(--color-text-tertiary)";
}

function getTextClass(score: number): string {
  if (score >= 80) return "text-accent-highlight";
  if (score >= 60) return "text-accent-primary";
  if (score >= 40) return "text-warning";
  return "text-text-tertiary";
}

export function IcpScoreBadge({ score, className, showHelp }: IcpScoreBadgeProps) {
  const size = 24;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = typeof score === "number" && !Number.isNaN(score) ? score : 0;
  const clamped = Math.max(0, Math.min(100, safeScore));
  const offset = circumference - (clamped / 100) * circumference;

  const badge = (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      title={`ICP Score: ${safeScore}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getStrokeColor(safeScore)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold leading-none",
          getTextClass(safeScore)
        )}
      >
        {safeScore}
      </span>
    </span>
  );

  if (showHelp) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {badge}
        <HelpTip text="How well this company matches your ideal prospect profile. Higher = better fit." />
      </span>
    );
  }

  return badge;
}
