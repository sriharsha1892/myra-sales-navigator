"use client";

import { cn } from "@/lib/cn";

interface IntelChipProps {
  label?: string;
  className?: string;
}

export function IntelChip({ label = "Mordor", className }: IntelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-intel-light px-2 py-0.5 text-[10px] font-medium text-intel",
        className
      )}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-intel" style={{ animation: "pulse-subtle 2s ease-in-out infinite" }} />
      {label}
    </span>
  );
}
