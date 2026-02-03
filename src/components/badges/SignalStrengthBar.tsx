"use client";

import { cn } from "@/lib/cn";

interface SignalStrengthBarProps {
  signalCount: number;
}

export function SignalStrengthBar({ signalCount }: SignalStrengthBarProps) {
  const fill = Math.min(signalCount / 4, 1) * 100;
  const colorClass =
    signalCount >= 4
      ? "bg-[#1B4D3E]"
      : signalCount === 3
      ? "bg-[#8FD9C4]"
      : signalCount === 2
      ? "bg-warning"
      : "bg-surface-3";

  return (
    <div
      className="h-1 w-10 flex-shrink-0 rounded-full bg-surface-3"
      title={`${signalCount} buying signal${signalCount !== 1 ? "s" : ""} detected`}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300", colorClass)}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}
