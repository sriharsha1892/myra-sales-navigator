"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/navigator/store";
import type { PipelineStage } from "@/lib/navigator/types";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/navigator/types";

interface CompanyStatusBadgeProps {
  domain: string;
  currentStatus: string;
  size?: "sm" | "md";
}

export function CompanyStatusBadge({ domain, currentStatus, size = "md" }: CompanyStatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const userName = useStore((s) => s.userName);
  const setCompanyStatus = useStore((s) => s.setCompanyStatus);
  const rawPipelineStages = useStore((s) => (s.adminConfig as unknown as Record<string, unknown>)?.pipelineStages as PipelineStage[] | undefined);
  const stages: PipelineStage[] = rawPipelineStages ?? DEFAULT_PIPELINE_STAGES;

  const currentStage = stages.find((s) => s.id === currentStatus) ?? stages[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, [open]);

  const handleSelect = (stageId: string) => {
    if (stageId !== currentStatus && userName) {
      setCompanyStatus(domain, stageId, userName);
    }
    setOpen(false);
  };

  if (size === "sm") {
    return (
      <span
        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: currentStage?.color ?? "#a1a1aa" }}
        aria-label={currentStage?.label ?? "New"}
      />
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-expanded={open}
        aria-label={`Pipeline status: ${currentStage?.label ?? "New"}. Click to change.`}
        className="flex items-center gap-1.5 rounded-pill border border-surface-3 px-2 py-0.5 text-xs font-medium transition-colors hover:bg-surface-hover"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: currentStage?.color ?? "#a1a1aa" }}
        />
        <span className="text-text-secondary">{currentStage?.label ?? "New"}</span>
        <svg className="h-3 w-3 text-text-tertiary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-input border border-surface-3 bg-surface-1 py-1 shadow-lg">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={(e) => { e.stopPropagation(); handleSelect(stage.id); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-surface-hover ${
                stage.id === currentStatus ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              {stage.label}
              {stage.id === currentStatus && (
                <svg className="ml-auto h-3 w-3 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
