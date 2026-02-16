"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/cn";
import { HelpTip } from "@/components/navigator/shared/HelpTip";
import { Tooltip } from "@/components/navigator/shared/Tooltip";

interface IcpScoreBadgeProps {
  score: number;
  className?: string;
  showHelp?: boolean;
  breakdown?: { factor: string; points: number; matched: boolean }[];
  showBreakdown?: boolean;
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

export function IcpScoreBadge({ score, className, showHelp, breakdown, showBreakdown }: IcpScoreBadgeProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const size = 24;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = typeof score === "number" && !Number.isNaN(score) ? score : 0;
  const matchedCount = breakdown?.filter((b) => b.matched).length ?? 0;
  const showDash = breakdown !== undefined && matchedCount <= 1;
  const clamped = showDash ? 0 : Math.max(0, Math.min(100, safeScore));
  const offset = circumference - (clamped / 100) * circumference;

  const tooltipText = showDash ? "Fit Score: insufficient filters" : `Fit Score: ${safeScore}/100`;
  const badge = (
    <Tooltip text={tooltipText} placement="bottom">
      <span
        role="img"
        aria-label={tooltipText}
        className={cn("relative inline-flex items-center justify-center", className)}
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
        {!showDash && (
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
            style={{ "--ring-circumference": circumference, animation: "icpRingDraw 600ms ease-out" } as React.CSSProperties}
          />
        )}
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold leading-none",
          showDash ? "text-text-tertiary" : getTextClass(safeScore)
        )}
      >
        {showDash ? "—" : safeScore}
      </span>
      </span>
    </Tooltip>
  );

  if (showHelp) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {badge}
        <HelpTip text="How well this company matches your ideal prospect profile. Higher = better fit." />
      </span>
    );
  }

  // Hover breakdown popover
  if (showBreakdown && breakdown && breakdown.length > 0) {
    return (
      <span
        className="relative inline-flex"
        onMouseEnter={() => {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setPopoverOpen(true), 300);
        }}
        onMouseLeave={() => {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setPopoverOpen(false), 200);
        }}
      >
        {badge}
        {popoverOpen && (
          <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-card border border-surface-3 bg-surface-1 p-2.5 shadow-lg" style={{ minWidth: 180 }}>
            <div className="space-y-1">
              {breakdown.map((b, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1 text-text-secondary">
                    <span className={b.matched ? "text-success" : "text-danger"}>
                      {b.matched ? "✓" : "✕"}
                    </span>
                    {b.factor}
                  </span>
                  <span className={cn("font-mono", b.points > 0 ? "text-success" : b.points < 0 ? "text-danger" : "text-text-tertiary")}>
                    {b.points > 0 ? "+" : ""}{b.points}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 border-t border-surface-3 pt-1 text-right">
              <span className={cn("font-mono text-xs font-bold", getTextClass(safeScore))}>
                {safeScore}/100
              </span>
            </div>
          </div>
        )}
      </span>
    );
  }

  return badge;
}
