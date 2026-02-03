"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { CompanyEnriched } from "@/lib/types";
import { SourceBadge, IntelBadge, SignalStrengthBar, IcpScoreBadge } from "@/components/badges";
import { CompanyStatusBadge } from "@/components/dossier/CompanyStatusBadge";
import { useStore } from "@/lib/store";
import { ContactPreviewPopover } from "./ContactPreviewPopover";
import { HighlightTerms } from "@/components/shared/HighlightTerms";
import { pick } from "@/lib/ui-copy";

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

const freshsalesLabels: Record<string, string> = {
  new_lead: "FS: New Lead",
  contacted: "FS: Contacted",
  negotiation: "FS: Negotiation",
  won: "FS: Won",
  lost: "FS: Lost",
  customer: "FS: Customer",
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
  const openContacts = useStore((s) => s.openContacts);
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);
  const [logoError, setLogoError] = useState(false);
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      // Prefetch company dossier (includes Freshsales status)
      queryClient.prefetchQuery({
        queryKey: ["company", company.domain],
        queryFn: async () => {
          const res = await fetch(`/api/company/${encodeURIComponent(company.domain)}`);
          if (!res.ok) throw new Error("Failed");
          return res.json();
        },
        staleTime: 5 * 60 * 1000,
      });
      // Prefetch contacts
      queryClient.prefetchQuery({
        queryKey: ["company-contacts", company.domain],
        queryFn: async () => {
          const res = await fetch(`/api/company/${encodeURIComponent(company.domain)}/contacts`);
          if (!res.ok) throw new Error("Failed");
          const data = await res.json();
          return data.contacts ?? [];
        },
        staleTime: 5 * 60 * 1000,
      });
    }, 500);
  }, [company.domain, queryClient]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const filledCount = [company.revenue, company.founded, company.website, company.phone, company.aiSummary, company.logoUrl]
    .filter(Boolean).length;

  const logoSrc = company.logoUrl ?? (company.domain ? `https://www.google.com/s2/favicons?domain=${company.domain}&sz=40` : null);
  const hasIntel = Array.isArray(company.sources) && company.sources.includes("mordor");

  return (
    <div
      id={`company-${company.domain}`}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group card-interactive cursor-pointer rounded-card border-[1.5px] p-3.5",
        isSelected
          ? "border-accent-primary bg-accent-primary-light shadow-sm"
          : "bg-surface-1 border-surface-3 shadow-sm",
        hasIntel && !isSelected && "border-intel/20 shadow-md",
        isChecked && "ring-1 ring-accent-highlight/30"
      )}
    >
      {/* Top row: checkbox + logo + name + signal bar */}
      <div className="flex items-start gap-2.5">
        <div className="mt-1 flex flex-col items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck();
            }}
            tabIndex={-1}
            className={cn(
              "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded transition-all duration-150",
              isChecked
                ? "bg-accent-primary text-white"
                : "border border-surface-3 hover:border-accent-primary"
            )}
          >
            {isChecked && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: "checkIn 150ms ease-out" }}
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <CompanyStatusBadge domain={company.domain} currentStatus={company.status ?? "new"} size="sm" />
        </div>
        {logoSrc && !logoError && (
          <img
            src={logoSrc}
            alt=""
            width={20}
            height={20}
            className="mt-0.5 h-5 w-5 flex-shrink-0 rounded"
            onError={() => setLogoError(true)}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-base font-semibold text-text-primary">
              {company.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <IcpScoreBadge score={company.icpScore} />
              <SignalStrengthBar signalCount={company.signals.length} />
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span>{company.industry}</span>
            <span className="text-text-tertiary">&middot;</span>
            <span>{company.employeeCount?.toLocaleString("en-US") ?? "—"} emp</span>
            {company.revenue && (
              <>
                <span className="text-text-tertiary">&middot;</span>
                <span>{company.revenue}</span>
              </>
            )}
            <span className="text-text-tertiary">&middot;</span>
            <span>{company.location}</span>
          </div>

          {/* Description */}
          {company.description && (
            <p className="mt-1 truncate text-xs text-text-tertiary">
              <HighlightTerms text={company.description} query={lastSearchQuery} />
            </p>
          )}

          {/* ICP breakdown — top 2 positive factors */}
          {company.icpBreakdown && company.icpBreakdown.filter((b) => b.matched && b.points > 0).length > 0 && (
            <div className="mt-1 flex items-center gap-1">
              {company.icpBreakdown
                .filter((b) => b.matched && b.points > 0)
                .slice(0, 2)
                .map((b) => (
                  <span
                    key={b.factor}
                    className="rounded-pill bg-success-light px-1.5 py-0.5 text-[9px] font-medium text-success"
                  >
                    {b.factor}
                  </span>
                ))}
            </div>
          )}

          {/* Signals — reworked */}
          {company.signals.length > 0 ? (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-pill px-2 py-0.5 text-[10px] font-medium capitalize",
                  signalPillColors[company.signals[0].type] ?? signalPillColors.news
                )}
              >
                {company.signals[0].type}
              </span>
              <span className="truncate text-xs text-text-secondary">
                {company.signals[0].title}
              </span>
              {company.signals.length > 1 && (
                <span className="flex-shrink-0 text-[10px] text-text-tertiary">
                  +{company.signals.length - 1} more
                </span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[10px] italic text-text-tertiary">
              {pick("empty_card_signals")}
            </p>
          )}

          {/* Bottom row: sources + hubspot + completeness + similar + contact count */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {(Array.isArray(company.sources) ? company.sources : []).map((src) => (
                <SourceBadge key={src} source={src} />
              ))}
              {hasIntel && <IntelBadge className="ml-1" />}
            </div>
            {company.freshsalesStatus !== "none" && (
              <span
                className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "rgba(62, 166, 123, 0.12)", color: "#3EA67B" }}
              >
                {freshsalesLabels[company.freshsalesStatus] ?? `FS: ${company.freshsalesStatus}`}
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
            {company.sources.length === 1 && company.sources[0] === "exa" && (
              <span className="text-[10px] italic text-warning">Limited data</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); searchSimilar(company); }}
              className="rounded px-1.5 py-0.5 text-[10px] text-accent-primary opacity-50 transition-opacity group-hover:opacity-100 hover:bg-accent-primary-light"
            >
              Similar
            </button>
            <div className="group/contacts relative ml-auto">
              <button
                onClick={(e) => { e.stopPropagation(); openContacts(company.domain); }}
                className="font-mono text-xs text-accent-secondary transition-colors hover:underline"
              >
                {company.contactCount} contacts
              </button>
              <ContactPreviewPopover domain={company.domain} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
