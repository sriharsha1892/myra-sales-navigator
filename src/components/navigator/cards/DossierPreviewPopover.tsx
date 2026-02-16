"use client";

import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { CompanyEnriched, Contact, Signal } from "@/lib/navigator/types";
import { IcpScoreBadge } from "@/components/navigator/badges/IcpScoreBadge";

interface DossierPreviewPopoverProps {
  domain: string;
  company: CompanyEnriched;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const signalPillColors: Record<string, string> = {
  hiring: "bg-info-light text-accent-primary",
  funding: "bg-success-light text-success",
  expansion: "bg-warning-light text-warning",
  news: "bg-surface-2 text-text-secondary",
};

const crmStatusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e" },
  in_progress: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e" },
  negotiation: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e" },
  new: { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6" },
  new_lead: { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6" },
  contacted: { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6" },
  closed_won: { bg: "rgba(249, 115, 22, 0.12)", text: "#f97316" },
  won: { bg: "rgba(249, 115, 22, 0.12)", text: "#f97316" },
  customer: { bg: "rgba(249, 115, 22, 0.12)", text: "#f97316" },
  closed_lost: { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444" },
  lost: { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444" },
};

const freshsalesLabels: Record<string, string> = {
  new_lead: "FS: New Lead",
  contacted: "FS: Contacted",
  negotiation: "FS: Negotiation",
  won: "FS: Won",
  lost: "FS: Lost",
  customer: "FS: Customer",
};

const hubspotLabels: Record<string, string> = {
  new: "HS: New",
  open: "HS: Open",
  in_progress: "HS: In Progress",
  closed_won: "HS: Won",
  closed_lost: "HS: Lost",
};

const SENIORITY_ORDER: Record<string, number> = {
  c_level: 0,
  vp: 1,
  director: 2,
  manager: 3,
  staff: 4,
};

export function DossierPreviewPopover({
  domain,
  company,
  onMouseEnter,
  onMouseLeave,
}: DossierPreviewPopoverProps) {
  const queryClient = useQueryClient();

  // Read from TanStack Query cache (already prefetched by CompanyCard 500ms hover)
  const cachedDossier = queryClient.getQueryData<{
    company?: CompanyEnriched;
    signals?: Signal[];
    freshsalesIntel?: CompanyEnriched["freshsalesIntel"];
  }>(["company", domain]);

  const cachedContacts =
    queryClient.getQueryData<Contact[]>(["company-contacts", domain]);

  // Merge: prefer cached dossier data, fall back to search-result company prop
  const signals = cachedDossier?.signals ?? company.signals ?? [];
  const freshsalesStatus =
    cachedDossier?.company?.freshsalesStatus ??
    company.freshsalesStatus;
  const hubspotStatus =
    cachedDossier?.company?.hubspotStatus ?? company.hubspotStatus;

  // Top 3 contacts sorted by seniority
  const topContacts = cachedContacts
    ? [...cachedContacts]
        .sort(
          (a, b) =>
            (SENIORITY_ORDER[a.seniority] ?? 5) -
            (SENIORITY_ORDER[b.seniority] ?? 5),
        )
        .slice(0, 3)
    : [];

  const topSignal = signals.length > 0 ? signals[0] : null;

  return (
    <div
      className="absolute left-full top-0 z-50 ml-2 w-[320px] max-h-[300px] overflow-y-auto rounded-card border border-surface-3 bg-surface-1 p-3 shadow-lg animate-fadeInUp"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header: name + ICP badge */}
      <div className="flex items-center gap-2">
        <h4
          className="min-w-0 truncate font-display text-sm font-semibold text-text-primary"
          title={company.name}
        >
          {company.name}
        </h4>
        <IcpScoreBadge score={company.icpScore} />
      </div>

      {/* CRM status line */}
      {((freshsalesStatus && freshsalesStatus !== "none") ||
        (hubspotStatus && hubspotStatus !== "none")) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {freshsalesStatus && freshsalesStatus !== "none" && (() => {
            const colors =
              crmStatusColors[freshsalesStatus] ?? {
                bg: "rgba(107, 114, 128, 0.12)",
                text: "#6b7280",
              };
            return (
              <span
                className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {freshsalesLabels[freshsalesStatus] ??
                  `FS: ${freshsalesStatus}`}
              </span>
            );
          })()}
          {hubspotStatus && hubspotStatus !== "none" && (() => {
            const colors =
              crmStatusColors[hubspotStatus] ?? {
                bg: "rgba(107, 114, 128, 0.12)",
                text: "#6b7280",
              };
            return (
              <span
                className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: colors.bg, color: colors.text }}
              >
                {hubspotLabels[hubspotStatus] ?? `HS: ${hubspotStatus}`}
              </span>
            );
          })()}
        </div>
      )}

      {/* Top signal */}
      {topSignal && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-pill px-2 py-0.5 text-[10px] font-medium capitalize",
              signalPillColors[topSignal.type] ?? signalPillColors.news,
            )}
          >
            {topSignal.type}
          </span>
          <span
            className="truncate text-[11px] text-text-secondary"
            title={topSignal.title}
          >
            {topSignal.title}
          </span>
        </div>
      )}

      {/* Top 3 contacts */}
      {topContacts.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-surface-3 pt-2">
          {topContacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 text-[10px]"
            >
              <span className="truncate font-medium text-text-primary">
                {c.firstName} {c.lastName}
              </span>
              <span className="truncate text-text-tertiary">{c.title}</span>
              {c.email && (
                <span className="ml-auto max-w-[110px] shrink-0 truncate font-mono text-text-secondary">
                  {c.email}
                </span>
              )}
              {c.sources.includes("freshsales" as import("@/lib/navigator/types").ResultSource) && (
                <span className="flex-shrink-0 rounded-pill bg-[#c9a227]/15 px-1 py-px text-[9px] font-semibold text-[#c9a227]">
                  Warm
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No cached contacts yet */}
      {!cachedContacts && topContacts.length === 0 && (
        <div className="mt-2 border-t border-surface-3 pt-2">
          <p className="text-[10px] italic text-text-tertiary">
            Hover a moment longer to load contacts
          </p>
        </div>
      )}

      {/* Footer */}
      <p className="mt-2 text-[10px] text-accent-secondary">
        Click to open full dossier &rarr;
      </p>
    </div>
  );
}
