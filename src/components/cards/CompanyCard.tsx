"use client";

import { cn } from "@/lib/cn";
import type { CompanyEnriched } from "@/lib/types";
import { SourceBadge, IcpScoreBadge } from "@/components/badges";
import { useStore } from "@/lib/store";
import { ContactPreviewPopover } from "./ContactPreviewPopover";

interface CompanyCardProps {
  company: CompanyEnriched;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
}

const signalPillColors: Record<string, string> = {
  hiring: "bg-info-light text-accent-primary",
  funding: "bg-success-light text-success",
  expansion: "bg-warning-light text-warning",
  news: "bg-surface-2 text-text-secondary",
};

const hubspotLabels: Record<string, string> = {
  new: "HS: New",
  open: "HS: Open",
  in_progress: "HS: In Progress",
  closed_won: "HS: Won",
  closed_lost: "HS: Lost",
  none: "",
};

export function CompanyCard({
  company,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
}: CompanyCardProps) {
  const searchSimilar = useStore((s) => s.searchSimilar);

  const filledCount = [company.revenue, company.founded, company.website, company.phone, company.aiSummary, company.logoUrl]
    .filter(Boolean).length;

  return (
    <div
      id={`company-${company.domain}`}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        "group cursor-pointer rounded-card border-[1.5px] p-5 transition-all duration-[180ms]",
        isSelected
          ? "border-accent-primary bg-accent-primary-light shadow-sm"
          : "glass-card hover:-translate-y-0.5"
      )}
    >
      {/* Top row: checkbox + name + ICP score */}
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          className="mt-1 h-3.5 w-3.5 flex-shrink-0 rounded accent-accent-primary"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-base font-semibold text-text-primary">
              {company.name}
            </h3>
            <IcpScoreBadge score={company.icpScore} />
          </div>

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span>{company.industry}</span>
            <span className="text-text-tertiary">&middot;</span>
            <span>{company.employeeCount?.toLocaleString("en-US") ?? "—"} emp</span>
            <span className="text-text-tertiary">&middot;</span>
            <span>{company.location}</span>
          </div>

          {/* Signals as pills */}
          {company.signals.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {company.signals.slice(0, 3).map((signal) => (
                <span
                  key={signal.id}
                  className={cn(
                    "rounded-pill px-2.5 py-1 text-xs font-medium capitalize",
                    signalPillColors[signal.type] ?? signalPillColors.news
                  )}
                >
                  {signal.type}
                </span>
              ))}
              {company.signals.length > 3 && (
                <span className="text-[10px] text-text-tertiary">
                  +{company.signals.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Bottom row: sources + hubspot + completeness + similar + contact count */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-0.5">
              {(Array.isArray(company.sources) ? company.sources : []).map((src) => (
                <SourceBadge key={src} source={src} />
              ))}
            </div>
            {company.hubspotStatus !== "none" && (
              <span className="rounded-pill bg-accent-highlight-light px-1.5 py-0.5 text-[10px] font-medium text-accent-highlight">
                {hubspotLabels[company.hubspotStatus]}
              </span>
            )}
            {filledCount <= 4 && (
              <span
                className={cn(
                  "font-mono text-[10px]",
                  filledCount <= 2 ? "text-danger" : "text-warning"
                )}
                title="Data completeness"
              >
                {filledCount}/6
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); searchSimilar(company); }}
              className="rounded px-1.5 py-0.5 text-[10px] text-accent-primary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent-primary-light"
            >
              Similar
            </button>
            <div className="group/contacts relative ml-auto">
              <span className="cursor-default font-mono text-xs text-text-tertiary">
                {company.contactCount} contacts
              </span>
              <ContactPreviewPopover domain={company.domain} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
