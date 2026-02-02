"use client";

import { cn } from "@/lib/cn";
import type { ResultSource } from "@/lib/types";

const config: Record<ResultSource, { label: string; color: string }> = {
  exa: { label: "E", color: "bg-source-exa text-text-inverse" },
  apollo: { label: "A", color: "bg-source-apollo text-text-inverse" },
  hubspot: { label: "H", color: "bg-source-hubspot text-text-inverse" },
};

interface SourceBadgeProps {
  source: ResultSource;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const { label, color } = config[source];
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold leading-none",
        color,
        className
      )}
      title={source.charAt(0).toUpperCase() + source.slice(1)}
    >
      {label}
    </span>
  );
}
