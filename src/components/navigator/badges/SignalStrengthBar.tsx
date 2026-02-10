"use client";

import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/navigator/shared/Tooltip";

interface SignalStrengthBarProps {
  signalCount: number;
  signalTypes?: string[];
}

export function SignalStrengthBar({ signalCount, signalTypes }: SignalStrengthBarProps) {
  const fill = Math.min(signalCount / 4, 1) * 100;
  const colorClass =
    signalCount >= 4
      ? "bg-[#1B4D3E]"
      : signalCount === 3
      ? "bg-[#8FD9C4]"
      : signalCount === 2
      ? "bg-warning"
      : "bg-surface-3";

  const tooltipText = signalCount === 0
    ? "No buying signals detected"
    : signalTypes && signalTypes.length > 0
      ? `${signalCount} signal${signalCount !== 1 ? "s" : ""}: ${signalTypes.join(", ")}`
      : `${signalCount} buying signal${signalCount !== 1 ? "s" : ""} detected`;

  return (
    <Tooltip text={tooltipText} placement="bottom">
      <div role="img" aria-label={tooltipText} className="h-1 w-10 flex-shrink-0 rounded-full bg-surface-3">
        <div
          className={cn("h-full rounded-full transition-all duration-300", colorClass)}
          style={{ width: `${fill}%` }}
        />
      </div>
    </Tooltip>
  );
}
