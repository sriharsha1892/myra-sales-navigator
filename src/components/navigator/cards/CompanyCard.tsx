"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { CompanyEnriched } from "@/lib/navigator/types";
import { IcpScoreBadge } from "@/components/navigator/badges";
import { CompanyStatusBadge } from "@/components/navigator/dossier/CompanyStatusBadge";
import { useStore } from "@/lib/navigator/store";
import { ContactPreviewPopover } from "./ContactPreviewPopover";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import type { Contact } from "@/lib/navigator/types";
import { logEmailCopy } from "@/lib/navigator/logEmailCopy";
import { TeamActivityBadge } from "@/components/navigator/badges/TeamActivityBadge";
import { pick } from "@/lib/navigator/ui-copy";

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
  new: "CRM: New",
  open: "CRM: Open",
  in_progress: "CRM: In Progress",
  closed_won: "CRM: Won",
  closed_lost: "CRM: Lost",
  none: "",
};

const SENIORITY_ORDER: Record<string, number> = {
  c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
};

const SENIORITY_CHIP_COLORS: Record<string, string> = {
  c_level: "bg-[#d4a012]/15 text-[#d4a012] border-[#d4a012]/30",
  vp: "bg-[#22d3ee]/15 text-[#22d3ee] border-[#22d3ee]/30",
  director: "bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/30",
  manager: "bg-surface-2 text-text-secondary border-surface-3",
  staff: "bg-surface-2 text-text-tertiary border-surface-3",
};

const SENIORITY_LABELS: Record<string, string> = {
  c_level: "C-Level", vp: "VP", director: "Director", manager: "Manager", staff: "Staff",
};

const TITLE_FILTER_RE = /intern|coordinator|assistant|trainee|apprentice/i;

function getVerificationDotColor(contact: Contact): string {
  switch (contact.verificationStatus) {
    case "valid": return "bg-success";
    case "valid_risky": return "bg-warning";
    case "invalid": return "bg-danger";
    default: return "bg-surface-3 ring-1 ring-text-tertiary";
  }
}

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
  new_lead: "CRM: New Lead",
  contacted: "CRM: Contacted",
  negotiation: "CRM: Negotiation",
  won: "CRM: Won",
  lost: "CRM: Lost",
  customer: "CRM: Customer",
  none: "",
};

export function CompanyCard({
  company,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
}: CompanyCardProps) {
  const setExpandedContactsDomain = useStore((s) => s.setExpandedContactsDomain);
  const contactsForDomain = useStore((s) => s.contactsByDomain[company.domain]);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);
  const setContactsForDomain = useStore((s) => s.setContactsForDomain);
  const companyDecision = useStore((s) => s.companyDecisions?.[company.domain]);
  const setCompanyDecision = useStore((s) => s.setCompanyDecision);
  const isInProspectList = useStore((s) => s.prospectList?.has(company.domain) ?? false);
  const addToProspectList = useStore((s) => s.addToProspectList);
  const removeFromProspectList = useStore((s) => s.removeFromProspectList);
  const addToast = useStore((s) => s.addToast);
  const selectCompany = useStore((s) => s.selectCompany);
  const setScrollToContactId = useStore((s) => s.setScrollToContactId);
  const [logoError, setLogoError] = useState(false);
  const [inlineContactsLoading, setInlineContactsLoading] = useState(false);
  const [showMoreContacts, setShowMoreContacts] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      setIsPrefetching(true);
      const p1 = queryClient.prefetchQuery({
        queryKey: ["company", company.domain],
        queryFn: async () => {
          const res = await fetch(`/api/company/${encodeURIComponent(company.domain)}`);
          if (!res.ok) throw new Error("Failed");
          return res.json();
        },
        staleTime: 5 * 60 * 1000,
      });
      const p2 = queryClient.prefetchQuery({
        queryKey: ["company-contacts", company.domain],
        queryFn: async () => {
          const res = await fetch(`/api/company/${encodeURIComponent(company.domain)}/contacts`);
          if (!res.ok) throw new Error("Failed");
          const data = await res.json();
          return data.contacts ?? [];
        },
        staleTime: 5 * 60 * 1000,
      });
      Promise.all([p1, p2]).finally(() => setIsPrefetching(false));
    }, 500);
  }, [company.domain, queryClient]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const logoSrc = company.logoUrl ?? (company.domain ? `https://www.google.com/s2/favicons?domain=${company.domain}&sz=40` : null);

  // Compute top 3 contacts for inline display
  const inlineContacts = (() => {
    if (!contactsForDomain || contactsForDomain.length === 0) return [];
    return [...contactsForDomain]
      .filter((c) => !TITLE_FILTER_RE.test(c.title ?? ""))
      .sort((a, b) => {
        const sa = SENIORITY_ORDER[a.seniority] ?? 5;
        const sb = SENIORITY_ORDER[b.seniority] ?? 5;
        if (sa !== sb) return sa - sb;
        return b.emailConfidence - a.emailConfidence;
      })
      .slice(0, showMoreContacts ? 10 : 3);
  })();

  const hasContactsLoaded = !!contactsForDomain;
  const totalContactsCount = contactsForDomain?.length ?? 0;

  const handleLoadContacts = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inlineContactsLoading || hasContactsLoaded) return;
    setInlineContactsLoading(true);
    const nameParam = company.name && company.name !== company.domain ? `?name=${encodeURIComponent(company.name)}` : "";
    fetch(`/api/company/${encodeURIComponent(company.domain)}/contacts${nameParam}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setContactsForDomain(company.domain, data.contacts ?? []);
      })
      .catch(() => { /* silent */ })
      .finally(() => setInlineContactsLoading(false));
  };

  const handleContactClick = (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation();
    selectCompany(company.domain);
    setScrollToContactId(contactId);
  };

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
        "group card-interactive cursor-pointer rounded-card border-[1.5px] px-4 py-3",
        isSelected
          ? "border-accent-primary bg-accent-primary-light shadow-sm"
          : "bg-surface-1 border-surface-3 shadow-sm",
        isChecked && "ring-1 ring-accent-highlight/30",
        isPrefetching && "ring-1 ring-accent-secondary/20 animate-pulse",
        companyDecision === "interested" && !isSelected && "border-success/30",
        isInProspectList && !isSelected && "border-l-accent-secondary/50"
      )}
    >
      {/* Top row: checkbox + logo + name */}
      <div className="flex items-start gap-2.5">
        <div className="mt-1 flex flex-col items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck();
            }}
            tabIndex={-1}
            aria-label={isChecked ? `Deselect ${company.name}` : `Select ${company.name}`}
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
            <h3 className="truncate font-display text-base font-semibold text-text-primary" title={company.name}>
              {company.name}
            </h3>
            <div className="flex items-center gap-1.5">
              {company.teamActivity && <TeamActivityBadge activity={company.teamActivity} />}
              <IcpScoreBadge score={company.icpScore} breakdown={company.icpBreakdown} showBreakdown />
              {company.nlIcpReasoning && (
                <span className="max-w-[200px] truncate text-[10px] text-text-tertiary italic" title={company.nlIcpReasoning}>
                  {company.nlIcpReasoning}
                </span>
              )}
            </div>
          </div>

          {/* CRM status badges — prominent color-coded */}
          {((company.freshsalesStatus && company.freshsalesStatus !== "none") || (company.hubspotStatus !== "none" && company.hubspotStatus)) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {company.freshsalesStatus && company.freshsalesStatus !== "none" && (() => {
                const colors = crmStatusColors[company.freshsalesStatus] ?? { bg: "rgba(107, 114, 128, 0.12)", text: "#6b7280" };
                const deal = company.freshsalesIntel?.deals?.[0];
                const label = deal
                  ? `${freshsalesLabels[company.freshsalesStatus] ?? company.freshsalesStatus}${deal.amount ? ` · $${(deal.amount / 1000).toFixed(0)}K` : ""}${deal.stage ? ` · ${deal.stage}` : ""}`
                  : (freshsalesLabels[company.freshsalesStatus] ?? `CRM: ${company.freshsalesStatus}`);
                return (
                  <span
                    className="rounded-pill px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {label}
                  </span>
                );
              })()}
              {company.hubspotStatus !== "none" && company.hubspotStatus && (() => {
                const colors = crmStatusColors[company.hubspotStatus] ?? { bg: "rgba(107, 114, 128, 0.12)", text: "#6b7280" };
                return (
                  <span
                    className="rounded-pill px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {hubspotLabels[company.hubspotStatus] || `CRM: ${company.hubspotStatus}`}
                  </span>
                );
              })()}
              {company.freshsalesStatus && company.freshsalesStatus !== "none" && company.freshsalesIntel?.account?.owner && (
                <span className="ml-1 text-[10px] text-text-tertiary">
                  &middot; {company.freshsalesIntel.account.owner.name}
                </span>
              )}
            </div>
          )}

          {/* Meta row */}
          <div className="mt-1 flex flex-nowrap items-center gap-2 text-sm text-text-secondary">
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

          {/* Signal headline */}
          {company.signals.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-pill px-2 py-0.5 text-[10px] font-medium capitalize",
                  signalPillColors[company.signals[0].type] ?? signalPillColors.news
                )}
              >
                {company.signals[0].type}
              </span>
              <span className="truncate text-xs text-text-secondary" title={company.signals[0].title}>
                {company.signals[0].title}
              </span>
              {company.signals.length > 1 && (
                <span className="flex-shrink-0 text-[10px] text-text-tertiary">
                  +{company.signals.length - 1} more
                </span>
              )}
            </div>
          )}

          {/* Bottom row: triage + contact count */}
          <div className="mt-2 flex items-center gap-2">
            {/* Triage buttons */}
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <Tooltip text="Interested">
                <button
                  onClick={(e) => { e.stopPropagation(); setCompanyDecision(company.domain, "interested"); }}
                  aria-label="Mark as interested"
                  className={cn(
                    "rounded p-0.5 transition-colors",
                    companyDecision === "interested"
                      ? "bg-success/20 text-success"
                      : "text-text-tertiary hover:bg-success/10 hover:text-success"
                  )}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip text="Pass">
                <button
                  onClick={(e) => { e.stopPropagation(); setCompanyDecision(company.domain, "pass"); }}
                  aria-label="Mark as pass"
                  className={cn(
                    "rounded p-0.5 transition-colors",
                    companyDecision === "pass"
                      ? "bg-danger/20 text-danger"
                      : "text-text-tertiary hover:bg-danger/10 hover:text-danger"
                  )}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip text={isInProspectList ? "Remove from list" : "Add to list"}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isInProspectList) removeFromProspectList(company.domain);
                    else addToProspectList(company.domain);
                  }}
                  aria-label={isInProspectList ? "Remove from prospect list" : "Add to prospect list"}
                  className={cn(
                    "rounded p-0.5 transition-colors",
                    isInProspectList
                      ? "bg-accent-secondary/20 text-accent-secondary"
                      : "text-text-tertiary hover:bg-accent-secondary/10 hover:text-accent-secondary"
                  )}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={isInProspectList ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </Tooltip>
            </div>
            {/* Decision badge (visible when not hovering) */}
            {companyDecision && (
              <span className={cn(
                "rounded-pill px-1 py-0.5 text-[8px] font-medium group-hover:hidden",
                companyDecision === "interested" ? "bg-success/15 text-success" : "bg-surface-2 text-text-tertiary"
              )}>
                {companyDecision === "interested" ? "Interested" : "Pass"}
              </span>
            )}
            <div className="group/contacts relative ml-auto">
              <button
                onClick={(e) => { e.stopPropagation(); setExpandedContactsDomain(company.domain); }}
                className="font-mono text-xs text-accent-secondary transition-colors hover:underline"
              >
                {company.contactCount} contacts
              </button>
              <ContactPreviewPopover domain={company.domain} />
            </div>
          </div>

          {/* Inline contacts section */}
          {hasContactsLoaded ? (
            inlineContacts.length > 0 ? (
              <div className="mt-2 border-t border-surface-3 pt-2">
                <div className="space-y-1">
                  {inlineContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-surface-2/50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleContactSelection(contact.id); }}
                        aria-label={selectedContactIds.has(contact.id) ? `Deselect ${contact.firstName} ${contact.lastName}` : `Select ${contact.firstName} ${contact.lastName}`}
                        className={cn(
                          "flex h-3 w-3 flex-shrink-0 items-center justify-center rounded transition-all duration-150",
                          selectedContactIds.has(contact.id)
                            ? "bg-accent-primary text-white"
                            : "border border-surface-3 hover:border-accent-primary"
                        )}
                      >
                        {selectedContactIds.has(contact.id) && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={(e) => handleContactClick(e, contact.id)}
                        className="flex min-w-0 cursor-pointer items-center gap-1.5 hover:underline"
                      >
                        <span className="max-w-[120px] truncate font-medium text-text-primary" title={`${contact.firstName} ${contact.lastName}`}>
                          {contact.firstName} {contact.lastName}
                        </span>
                        <span className="max-w-[140px] truncate text-text-tertiary" title={contact.title ?? undefined}>
                          {contact.title}
                        </span>
                      </button>
                      <span className={cn(
                        "flex-shrink-0 rounded-pill border px-1 py-px text-[9px] font-medium",
                        SENIORITY_CHIP_COLORS[contact.seniority] ?? SENIORITY_CHIP_COLORS.staff
                      )}>
                        {SENIORITY_LABELS[contact.seniority] ?? contact.seniority}
                      </span>
                      <span
                        className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", getVerificationDotColor(contact))}
                        role="img"
                        aria-label={
                          contact.verificationStatus === "valid" ? "Email verified" :
                          contact.verificationStatus === "valid_risky" ? "Email valid but risky" :
                          contact.verificationStatus === "invalid" ? "Email invalid" :
                          "Email unverified"
                        }
                      />
                      {contact.email && (
                        <Tooltip text="Copy email">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(contact.email!).then(() => {
                                setCopiedContactId(contact.id);
                                addToast({ message: `Copied ${contact.email}`, type: "success", duration: 1500, dedupKey: "inline-copy" });
                                setTimeout(() => setCopiedContactId(null), 1500);
                                logEmailCopy(contact.email!, `${contact.firstName} ${contact.lastName}`, company.domain);
                              });
                            }}
                            aria-label={`Copy email for ${contact.firstName} ${contact.lastName}`}
                            className="flex-shrink-0 text-text-tertiary transition-colors hover:text-accent-primary"
                          >
                            {copiedContactId === contact.id ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </Tooltip>
                      )}
                      {contact.sources.includes("freshsales" as import("@/lib/navigator/types").ResultSource) && (
                        <span className="flex-shrink-0 rounded-pill bg-[#d4a012]/15 px-1 py-px text-[8px] font-semibold text-[#d4a012]">
                          Warm
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {totalContactsCount > 3 && !showMoreContacts && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMoreContacts(true); }}
                    className="mt-1 text-[10px] text-accent-secondary hover:underline"
                  >
                    Show more ({totalContactsCount - 3} more)
                  </button>
                )}
                {showMoreContacts && totalContactsCount > 10 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedContactsDomain(company.domain); }}
                    className="mt-1 text-[10px] text-accent-secondary hover:underline"
                  >
                    Show all {totalContactsCount} in expanded view
                  </button>
                )}
                {showMoreContacts && totalContactsCount <= 10 && totalContactsCount > 3 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMoreContacts(false); }}
                    className="mt-1 text-[10px] text-text-tertiary hover:text-text-secondary"
                  >
                    Show fewer
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 border-t border-surface-3 pt-1.5">
                <span className="text-[10px] italic text-text-tertiary">{pick("empty_contacts_inline")}</span>
              </div>
            )
          ) : (
            <div className="mt-2 border-t border-surface-3 pt-1.5">
              {inlineContactsLoading ? (
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-accent-secondary/30 border-t-accent-secondary" />
                  <span className="text-[10px] text-text-tertiary">Loading contacts...</span>
                </div>
              ) : (
                <button
                  onClick={handleLoadContacts}
                  className="text-[10px] text-accent-secondary/70 transition-colors hover:text-accent-secondary hover:underline"
                >
                  Load contacts
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
