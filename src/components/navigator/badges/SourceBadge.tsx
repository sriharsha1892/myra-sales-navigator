"use client";

import { cn } from "@/lib/cn";
import type { ResultSource } from "@/lib/navigator/types";
import { HelpTip } from "@/components/navigator/shared/HelpTip";
import { Tooltip } from "@/components/navigator/shared/Tooltip";

const config: Partial<Record<ResultSource, { label: string; color: string }>> = {
  exa: { label: "E", color: "bg-source-exa text-text-inverse" },
  apollo: { label: "A", color: "bg-source-apollo text-text-inverse" },
  hubspot: { label: "H", color: "bg-source-hubspot text-text-inverse" },
  clearout: { label: "C", color: "bg-source-clearout text-text-inverse" },
  mordor: { label: "M", color: "bg-source-mordor text-text-inverse" },
  freshsales: { label: "F", color: "bg-source-freshsales text-text-inverse" },
};

interface SourceBadgeProps {
  source: ResultSource;
  className?: string;
  showHelp?: boolean;
}

export function SourceBadge({ source, className, showHelp }: SourceBadgeProps) {
  const entry = config[source];
  if (!entry) return null;
  const { label, color } = entry;
  const fullName = source.charAt(0).toUpperCase() + source.slice(1);
  const badge = (
    <Tooltip text={fullName}>
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold leading-none",
          color,
          className
        )}
      >
        {label}
      </span>
    </Tooltip>
  );

  if (showHelp) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {badge}
        <HelpTip text="Where this data came from. E = Exa (web intelligence), A = Apollo (contacts database), H = HubSpot (your CRM), C = Clearout (email verification), M = Mordor (internal), F = Freshsales (CRM)" />
      </span>
    );
  }

  return badge;
}
