"use client";

import { useState, useRef, useCallback } from "react";
import { useSessionResume } from "@/hooks/navigator/useSessionResume";
import { useStore } from "@/lib/navigator/store";
import { timeAgo } from "@/lib/utils";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/navigator/types";
import type { PipelineStage } from "@/lib/navigator/types";

interface HoverPreview {
  name: string;
  domain: string;
  employeeCount?: number;
  topSignal?: string;
  x: number;
  y: number;
}

export function MyProspects() {
  const { recentCompanies, inProgress, isLoading } = useSessionResume();
  const selectCompany = useStore((s) => s.selectCompany);
  const adminConfig = useStore((s) => s.adminConfig);

  const [hover, setHover] = useState<HoverPreview | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stages: PipelineStage[] =
    (adminConfig as unknown as Record<string, unknown>).pipelineStages as PipelineStage[] | undefined
    ?? DEFAULT_PIPELINE_STAGES;

  const showPreview = useCallback((e: React.MouseEvent, company: { name: string; domain: string; employee_count?: number; top_signal?: string }) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHover({
        name: company.name,
        domain: company.domain,
        employeeCount: company.employee_count,
        topSignal: company.top_signal,
        x: rect.left,
        y: rect.top - 8,
      });
    }, 200);
  }, []);

  const hidePreview = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHover(null);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3 px-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shimmer h-14 rounded-card" />
        ))}
      </div>
    );
  }

  const hasContent = recentCompanies.length > 0 || inProgress.length > 0;
  if (!hasContent) return null;

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Hover preview tooltip */}
      {hover && (
        <div
          className="pointer-events-none fixed z-30 rounded-card border border-surface-3 bg-surface-1 px-3 py-2 shadow-md"
          style={{ left: hover.x, top: hover.y, transform: "translateY(-100%)" }}
        >
          <p className="text-xs font-medium text-text-primary">{hover.domain}</p>
          {hover.employeeCount != null && (
            <p className="text-[10px] text-text-tertiary">{hover.employeeCount.toLocaleString()} emp</p>
          )}
          {hover.topSignal && (
            <p className="text-[10px] text-accent-secondary">{hover.topSignal}</p>
          )}
        </div>
      )}

      {/* In-progress pipeline items */}
      {inProgress.length > 0 && (
        <div>
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            In Progress
          </p>
          <div className="space-y-1">
            {inProgress.map((company) => {
              const stage = stages.find((s) => s.id === company.status);
              return (
                <button
                  key={company.domain}
                  onClick={() => selectCompany(company.domain)}
                  onMouseEnter={(e) => showPreview(e, company)}
                  onMouseLeave={hidePreview}
                  className="flex w-full items-center gap-2 rounded-card border border-surface-3 bg-surface-1 px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-surface-2"
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage?.color ?? "#a1a1aa" }}
                  />
                  <span className="truncate flex-1 text-left">{company.name}</span>
                  <span className="text-[10px] text-text-tertiary">{stage?.label ?? company.status}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent companies */}
      {recentCompanies.length > 0 && (
        <div>
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            Recently Viewed
          </p>
          <div className="space-y-1">
            {recentCompanies.slice(0, 3).map((company) => {
              const stage = stages.find((s) => s.id === company.status);
              return (
                <button
                  key={company.domain}
                  onClick={() => selectCompany(company.domain)}
                  onMouseEnter={(e) => showPreview(e, company)}
                  onMouseLeave={hidePreview}
                  className="flex w-full items-center gap-2 rounded-card border border-surface-3 bg-surface-1 px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-surface-2"
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage?.color ?? "#a1a1aa" }}
                  />
                  <span className="truncate flex-1 text-left">{company.name}</span>
                  <span className="text-[10px] text-text-tertiary">
                    {timeAgo(company.last_viewed_at)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
