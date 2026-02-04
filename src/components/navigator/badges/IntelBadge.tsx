"use client";

import { cn } from "@/lib/cn";

interface IntelBadgeProps {
  className?: string;
}

export function IntelBadge({ className }: IntelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill bg-intel px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-inverse",
        className
      )}
    >
      INTEL
    </span>
  );
}
