"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { CompanyEnriched, CompanyPipelineStage } from "@/lib/navigator/types";
import { IcpScoreBadge } from "@/components/navigator/badges";
import { CompanyStatusBadge } from "@/components/navigator/dossier/CompanyStatusBadge";
import { useStore } from "@/lib/navigator/store";
import { ContactPreviewPopover } from "./ContactPreviewPopover";
import { RelevanceFeedbackPopover } from "./RelevanceFeedbackPopover";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import type { Contact } from "@/lib/navigator/types";
import { logEmailCopy } from "@/lib/navigator/logEmailCopy";
import { TeamActivityBadge } from "@/components/navigator/badges/TeamActivityBadge";
import { pick } from "@/lib/navigator/ui-copy";
import { DossierPreviewPopover } from "./DossierPreviewPopover";
import { isStale } from "@/lib/navigator/staleness";
import { formatTimeAgo } from "@/components/navigator/shared/StalenessIndicator";
import { hasStaleRefreshed, markStaleRefreshed } from "@/lib/navigator/store";
import { getVerificationDotColor } from "@/lib/navigator/verification";
import { CompanyLogo } from "@/components/navigator/shared/CompanyLogo";

interface CompanyCardProps {
  company: CompanyEnriched;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  compact?: boolean;
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
  c_level: "bg-accent-primary/15 text-accent-primary border-accent-primary/30",
  vp: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30",
  director: "bg-seniority-director/15 text-seniority-director border-seniority-director/30",
  manager: "bg-surface-2 text-text-secondary border-surface-3",
  staff: "bg-surface-2 text-text-tertiary border-surface-3",
};

const SENIORITY_LABELS: Record<string, string> = {
  c_level: "C-Level", vp: "VP", director: "Director", manager: "Manager", staff: "Staff",
};

const TITLE_FILTER_RE = /intern|coordinator|assistant|trainee|apprentice/i;

const crmStatusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: "var(--color-crm-open-light)", text: "var(--color-crm-open)" },
  in_progress: { bg: "var(--color-crm-open-light)", text: "var(--color-crm-open)" },
  negotiation: { bg: "var(--color-crm-open-light)", text: "var(--color-crm-open)" },
  new: { bg: "var(--color-crm-new-light)", text: "var(--color-crm-new)" },
  new_lead: { bg: "var(--color-crm-new-light)", text: "var(--color-crm-new)" },
  contacted: { bg: "var(--color-crm-new-light)", text: "var(--color-crm-new)" },
  closed_won: { bg: "var(--color-crm-won-light)", text: "var(--color-crm-won)" },
  won: { bg: "var(--color-crm-won-light)", text: "var(--color-crm-won)" },
  customer: { bg: "var(--color-crm-won-light)", text: "var(--color-crm-won)" },
  closed_lost: { bg: "var(--color-crm-lost-light)", text: "var(--color-crm-lost)" },
  lost: { bg: "var(--color-crm-lost-light)", text: "var(--color-crm-lost)" },
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

const PIPELINE_STAGE_CONFIG: Record<CompanyPipelineStage, { label: string; dotClass: string }> = {
  new: { label: "New", dotClass: "bg-surface-3" },
  reviewing: { label: "Reviewing", dotClass: "bg-accent-secondary" },
  interested: { label: "Interested", dotClass: "bg-accent-primary" },
  passed: { label: "Passed", dotClass: "bg-text-tertiary" },
  in_crm: { label: "In CRM", dotClass: "bg-[var(--color-source-freshsales,#3EA67B)]" },
  excluded: { label: "Excluded", dotClass: "bg-danger" },
};

export function CompanyCard({
  company,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  compact,
}: CompanyCardProps) {
  const expandedContactsDomain = useStore((s) => s.expandedContactsDomain);
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
  const rfEntry = useStore((s) => s.relevanceFeedback?.[company.domain]);
  const setRelevanceFeedback = useStore((s) => s.setRelevanceFeedback);
  const clearRelevanceFeedback = useStore((s) => s.clearRelevanceFeedback);
  const showHiddenResults = useStore((s) => s.showHiddenResults);
  const setSimilarResults = useStore((s) => s.setSimilarResults);
  const setSimilarLoading = useStore((s) => s.setSimilarLoading);
  const similarLoading = useStore((s) => s.similarLoading);
  const hoverPrefetchEnabled = useStore((s) => s.hoverPrefetchEnabled);
  const incrementBackgroundNetwork = useStore((s) => s.incrementBackgroundNetwork);
  const decrementBackgroundNetwork = useStore((s) => s.decrementBackgroundNetwork);

  // Derive pipeline stage from individually-subscribed values (ensures re-render on change)
  const pipelineStage = useMemo((): CompanyPipelineStage => {
    if (company.excluded) return "excluded";
    const fsStatus = company.freshsalesStatus;
    const hsStatus = company.hubspotStatus;
    if ((fsStatus && fsStatus !== "none") || (hsStatus && hsStatus !== "none")) return "in_crm";
    if (companyDecision === "interested") return "interested";
    if (companyDecision === "pass" || companyDecision === "skip") return "passed";
    if (rfEntry || isInProspectList) return "reviewing";
    return "new";
  }, [company.excluded, company.freshsalesStatus, company.hubspotStatus, companyDecision, rfEntry, isInProspectList]);

  const stageConfig = PIPELINE_STAGE_CONFIG[pipelineStage];

  const [rfPopoverOpen, setRfPopoverOpen] = useState(false);
  const [inlineContactsLoading, setInlineContactsLoading] = useState(false);
  const [showMoreContacts, setShowMoreContacts] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedBestEmail, setCopiedBestEmail] = useState(false);
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stale = isStale(company.lastRefreshed);

  const handleMouseEnter = useCallback(() => {
    if (hoverPrefetchEnabled) {
      hoverTimerRef.current = setTimeout(() => {
        setIsPrefetching(true);
        incrementBackgroundNetwork();
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
        Promise.all([p1, p2]).finally(() => {
          setIsPrefetching(false);
          decrementBackgroundNetwork();
        });
      }, 500);
    }
    previewTimerRef.current = setTimeout(() => setShowPreview(true), 800);

    // Stale data: fire-and-forget background refresh on first hover this session
    if (stale && !hasStaleRefreshed(company.domain)) {
      markStaleRefreshed(company.domain);
      incrementBackgroundNetwork();
      fetch(`/api/company/${encodeURIComponent(company.domain)}`)
        .catch(() => {})
        .finally(() => decrementBackgroundNetwork());
    }
  }, [company.domain, queryClient, stale, hoverPrefetchEnabled, incrementBackgroundNetwork, decrementBackgroundNetwork]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setShowPreview(false);
  }, []);

  const logoSrc = company.logoUrl ?? (company.domain ? `https://www.google.com/s2/favicons?domain=${company.domain}&sz=40` : null);

  // Compute top contacts for inline display (memoized to avoid re-sorting on every render)
  const inlineContacts = useMemo(() => {
    if (!contactsForDomain || contactsForDomain.length === 0) return [];
    return [...contactsForDomain]
      .filter((c) => !TITLE_FILTER_RE.test(c.title ?? ""))
      .sort((a, b) => {
        // Freshsales contacts first
        const aFS = a.sources.includes("freshsales" as import("@/lib/navigator/types").ResultSource) ? 0 : 1;
        const bFS = b.sources.includes("freshsales" as import("@/lib/navigator/types").ResultSource) ? 0 : 1;
        if (aFS !== bFS) return aFS - bFS;
        // Then by seniority
        const sa = SENIORITY_ORDER[a.seniority] ?? 5;
        const sb = SENIORITY_ORDER[b.seniority] ?? 5;
        if (sa !== sb) return sa - sb;
        return b.emailConfidence - a.emailConfidence;
      })
      .slice(0, showMoreContacts ? 10 : 3);
  }, [contactsForDomain, showMoreContacts]);

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

  // Best email for quick-copy button (first Freshsales contact with email, else first with email)
  const bestContact = inlineContacts.find((c) => c.email);
  const bestEmail = bestContact?.email ?? null;

  // Auto-load contacts for exact match companies (Freshsales prominence)
  useEffect(() => {
    if (!company.exactMatch || hasContactsLoaded || inlineContactsLoading) return;
    let cancelled = false;
    const nameParam = company.name && company.name !== company.domain ? `?name=${encodeURIComponent(company.name)}` : "";
    // Use queueMicrotask to defer setState (React Compiler: no sync setState in effects)
    queueMicrotask(() => { if (!cancelled) setInlineContactsLoading(true); });
    fetch(`/api/company/${encodeURIComponent(company.domain)}/contacts${nameParam}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        if (!cancelled) setContactsForDomain(company.domain, data.contacts ?? []);
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setInlineContactsLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when exactMatch + no contacts loaded
  }, [company.exactMatch, company.domain]);

  // Split inline contacts into CRM (Freshsales) and other for visual separation
  const crmContacts = useMemo(() => inlineContacts.filter((c) => c.sources.includes("freshsales" as import("@/lib/navigator/types").ResultSource)), [inlineContacts]);
  const otherContacts = useMemo(() => inlineContacts.filter((c) => !c.sources.includes("freshsales" as import("@/lib/navigator/types").ResultSource)), [inlineContacts]);

  // ─── Compact mode ─── early return with minimal card
  if (compact) {
    const crmPill = company.freshsalesStatus && company.freshsalesStatus !== "none"
      ? { label: freshsalesLabels[company.freshsalesStatus] ?? company.freshsalesStatus, colors: crmStatusColors[company.freshsalesStatus] ?? { bg: "rgba(107,114,128,0.12)", text: "#6b7280" } }
      : company.hubspotStatus && company.hubspotStatus !== "none"
        ? { label: hubspotLabels[company.hubspotStatus] || company.hubspotStatus, colors: crmStatusColors[company.hubspotStatus] ?? { bg: "rgba(107,114,128,0.12)", text: "#6b7280" } }
        : null;

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
          "group relative flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors",
          isSelected ? "border-accent-primary bg-accent-primary-light" : "border-surface-3 bg-surface-1 hover:border-accent-primary/30",
          isChecked && "ring-1 ring-accent-highlight/30"
        )}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
          tabIndex={-1}
          aria-label={isChecked ? `Deselect ${company.name}` : `Select ${company.name}`}
          className={cn(
            "flex h-3 w-3 flex-shrink-0 items-center justify-center rounded transition-all duration-150",
            isChecked ? "bg-accent-primary text-white" : "border border-surface-3 hover:border-accent-primary"
          )}
        >
          {isChecked && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        <CompanyLogo logoUrl={logoSrc} domain={company.domain} name={company.name} size={16} className="h-4 w-4" />
        <Tooltip text={company.name}>
          <span className="min-w-0 max-w-[180px] truncate text-sm font-medium text-text-primary">
            {company.name}
          </span>
        </Tooltip>
        {pipelineStage !== "new" && (
          <span className="flex flex-shrink-0 items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", stageConfig.dotClass)} />
            <span className="text-[9px] text-text-tertiary">{stageConfig.label}</span>
          </span>
        )}
        <span className="text-xs text-text-tertiary">&middot;</span>
        <span className="max-w-[120px] truncate text-xs text-text-secondary">{company.industry}</span>
        <span className="text-xs text-text-tertiary">&middot;</span>
        <span className="text-xs text-text-secondary">{company.employeeCount?.toLocaleString("en-US") ?? "—"}</span>
        <span className="text-xs text-text-tertiary">&middot;</span>
        <span className="max-w-[100px] truncate text-xs text-text-secondary">{company.location}</span>
        {stale && (
          <>
            <span className="text-xs text-text-tertiary">&middot;</span>
            <Tooltip text={formatTimeAgo(company.lastRefreshed)}>
              <span className="text-[10px] text-warning flex-shrink-0">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-px mr-px"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                24h+
              </span>
            </Tooltip>
          </>
        )}
        {crmPill && (
          <span className="flex-shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: crmPill.colors.bg, color: crmPill.colors.text }}>
            {crmPill.label}
          </span>
        )}
        {company.signals.length > 0 && (
          <>
            <span className="text-xs text-text-tertiary">&middot;</span>
            <span className="max-w-[120px] truncate text-[10px] text-accent-secondary">
              {company.signals[0].title}
            </span>
          </>
        )}
        {inlineContacts.length > 0 && (
          <>
            <span className="text-xs text-text-tertiary">&middot;</span>
            <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary">
              <span className="font-medium text-text-secondary">
                {inlineContacts[0].firstName?.[0]}{inlineContacts[0].lastName?.[0]}
              </span>
              <span className="text-[8px]">
                {SENIORITY_LABELS[inlineContacts[0].seniority] ?? ""}
              </span>
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <IcpScoreBadge score={company.icpScore} breakdown={company.icpBreakdown} showBreakdown />
          {bestEmail && (
            <Tooltip text={`Copy: ${bestEmail}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(bestEmail).then(() => {
                    setCopiedBestEmail(true);
                    addToast({ message: `Copied ${bestEmail}`, type: "success", duration: 1500, dedupKey: "quick-copy" });
                    setTimeout(() => setCopiedBestEmail(false), 1500);
                    logEmailCopy(bestEmail, `${bestContact!.firstName} ${bestContact!.lastName}`, company.domain);
                  });
                }}
                aria-label="Copy best email"
                className="flex-shrink-0 text-text-tertiary transition-colors hover:text-accent-primary"
              >
                {copiedBestEmail ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
            </Tooltip>
          )}
        </div>
        {showPreview && !isSelected && (
          <DossierPreviewPopover
            domain={company.domain}
            company={company}
            onMouseEnter={() => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); }}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>
    );
  }

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
        "group relative card-interactive cursor-pointer rounded-card border-[1.5px] px-4 py-3",
        isSelected
          ? "border-accent-primary bg-accent-primary-light shadow-sm"
          : "bg-surface-1 border-surface-3 shadow-sm hover:border-accent-primary/30",
        isChecked && "ring-1 ring-accent-highlight/30",
        isPrefetching && "ring-1 ring-accent-secondary/20 animate-pulse",
        companyDecision === "interested" && !isSelected && "border-success/30",
        isInProspectList && !isSelected && "ring-1 ring-accent-secondary/30",
        rfEntry?.feedback === "not_relevant" && showHiddenResults && "opacity-40"
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
        <CompanyLogo logoUrl={logoSrc} domain={company.domain} name={company.name} size={20} className="mt-0.5 h-5 w-5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Tooltip text={company.name}>
                <h3 className="truncate font-display text-base font-semibold text-text-primary">
                  {company.name}
                </h3>
              </Tooltip>
              {pipelineStage !== "new" && (
                <span className="flex flex-shrink-0 items-center gap-1 rounded-pill border border-surface-3 px-1.5 py-px">
                  <span className={cn("h-1.5 w-1.5 rounded-full", stageConfig.dotClass)} />
                  <span className="text-[9px] text-text-tertiary">{stageConfig.label}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {bestEmail && (
                <Tooltip text={`Copy: ${bestEmail}`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(bestEmail).then(() => {
                        setCopiedBestEmail(true);
                        addToast({ message: `Copied ${bestEmail}`, type: "success", duration: 1500, dedupKey: "quick-copy" });
                        setTimeout(() => setCopiedBestEmail(false), 1500);
                        logEmailCopy(bestEmail, `${bestContact!.firstName} ${bestContact!.lastName}`, company.domain);
                      });
                    }}
                    aria-label="Copy best email"
                    className="flex-shrink-0 text-text-tertiary transition-colors hover:text-accent-primary"
                  >
                    {copiedBestEmail ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    )}
                  </button>
                </Tooltip>
              )}
              {company.teamActivity && <TeamActivityBadge activity={company.teamActivity} />}
              <IcpScoreBadge score={company.icpScore} breakdown={company.icpBreakdown} showBreakdown />
            </div>
          </div>
          {company.nlIcpReasoning && (
            <p className="mt-0.5 text-xs italic text-text-tertiary line-clamp-2">
              {company.nlIcpReasoning}
            </p>
          )}

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
            {stale && (
              <>
                <span className="text-text-tertiary">&middot;</span>
                <Tooltip text={formatTimeAgo(company.lastRefreshed)}>
                  <span className="text-[10px] text-warning flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-px mr-px"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    24h+
                  </span>
                </Tooltip>
              </>
            )}
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
              <Tooltip text={company.signals[0].title}>
                <span className="truncate text-xs text-text-secondary">
                  {company.signals[0].title}
                </span>
              </Tooltip>
              {company.signals.length > 1 && (
                <span className="flex-shrink-0 text-[10px] text-text-tertiary">
                  +{company.signals.length - 1} more
                </span>
              )}
            </div>
          )}

          {/* Bottom row: triage + contact count */}
          <div className="mt-2 flex items-center gap-2">
            {/* Triage buttons — always visible */}
            <div className="flex items-center gap-0.5">
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
              {!company.exactMatch && (
                <>
                  <div className="h-3 w-px bg-surface-3" />
                  <Tooltip text={rfEntry?.feedback === "relevant" ? "Remove relevant" : "Relevant"}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rfEntry?.feedback === "relevant") {
                          clearRelevanceFeedback(company.domain);
                        } else {
                          setRelevanceFeedback(company.domain, "relevant");
                        }
                      }}
                      aria-label="Mark as relevant"
                      className={cn(
                        "rounded p-0.5 transition-colors",
                        rfEntry?.feedback === "relevant"
                          ? "text-green-400"
                          : "text-text-tertiary hover:text-green-400"
                      )}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 10v12" /><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                      </svg>
                    </button>
                  </Tooltip>
                  <div className="relative">
                    <Tooltip text={rfEntry?.feedback === "not_relevant" ? "Remove not-relevant" : "Not relevant"}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (rfEntry?.feedback === "not_relevant") {
                            clearRelevanceFeedback(company.domain);
                          } else {
                            setRfPopoverOpen((prev) => !prev);
                          }
                        }}
                        aria-label="Mark as not relevant"
                        className={cn(
                          "rounded p-0.5 transition-colors",
                          rfEntry?.feedback === "not_relevant"
                            ? "text-red-400"
                            : "text-text-tertiary hover:text-red-400"
                        )}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 14V2" /><path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
                        </svg>
                      </button>
                    </Tooltip>
                    {rfPopoverOpen && (
                      <RelevanceFeedbackPopover
                        domain={company.domain}
                        currentReason={rfEntry?.reason}
                        onSelect={(reason) => {
                          setRelevanceFeedback(company.domain, "not_relevant", reason);
                          setRfPopoverOpen(false);
                        }}
                        onClose={() => setRfPopoverOpen(false)}
                      />
                    )}
                  </div>
                  <div className="h-3 w-px bg-surface-3" />
                  <Tooltip text="Find similar companies">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (similarLoading) return;
                        setSimilarLoading(true);
                        fetch("/api/search/similar", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            domain: company.domain,
                            name: company.name,
                            industry: company.industry || undefined,
                            region: company.region || undefined,
                            employeeCount: company.employeeCount || undefined,
                            description: company.description || undefined,
                          }),
                        })
                          .then(async (res) => {
                            if (!res.ok) throw new Error(`${res.status}`);
                            const data = await res.json();
                            setSimilarResults({
                              seedDomain: company.domain,
                              seedName: company.name,
                              companies: data.companies,
                            });
                          })
                          .catch(() => {
                            addToast({ message: "Failed to find similar companies", type: "error", duration: 3000 });
                          })
                          .finally(() => setSimilarLoading(false));
                      }}
                      aria-label="Find similar companies"
                      className={cn(
                        "rounded p-0.5 transition-colors",
                        similarLoading
                          ? "text-accent-secondary animate-pulse"
                          : "text-text-tertiary hover:text-accent-secondary"
                      )}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="10" height="10" rx="1.5" />
                        <rect x="11" y="11" width="10" height="10" rx="1.5" />
                      </svg>
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
            <div className="group/contacts relative ml-auto">
              <button
                onClick={(e) => { e.stopPropagation(); setExpandedContactsDomain(company.domain); }}
                aria-expanded={expandedContactsDomain === company.domain}
                aria-label={`Toggle contacts for ${company.name}`}
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
                {crmContacts.length > 0 && (
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-accent-primary">
                    CRM Contacts
                  </span>
                )}
                <div className="space-y-1">
                  {(crmContacts.length > 0 ? [...crmContacts, ...otherContacts] : inlineContacts).map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 rounded px-1 py-0.5 text-[11px] transition-colors hover:bg-surface-2"
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
                        <Tooltip text={`${contact.firstName} ${contact.lastName}`}>
                          <span className="max-w-[120px] truncate font-medium text-text-primary">
                            {contact.firstName} {contact.lastName}
                          </span>
                        </Tooltip>
                        {contact.title ? (
                          <Tooltip text={contact.title}>
                            <span className="max-w-[140px] truncate text-text-tertiary">
                              {contact.title}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="max-w-[140px] truncate text-text-tertiary">
                            {contact.title}
                          </span>
                        )}
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
                        <span className="flex-shrink-0 rounded-pill bg-accent-primary/15 px-1 py-px text-[9px] font-semibold text-accent-primary ring-1 ring-accent-primary/20">
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
      {showPreview && !isSelected && (
        <DossierPreviewPopover
          domain={company.domain}
          company={company}
          onMouseEnter={() => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); }}
          onMouseLeave={handleMouseLeave}
        />
      )}
    </div>
  );
}
