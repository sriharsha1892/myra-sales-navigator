"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "@/lib/navigator/store";
import {
  DossierCompactHeader,
  DossierOverview,
  DossierSignals,
  DossierHubspot,
  DossierFreshsales,
  DossierSkeleton,
  DossierSimilarCompanies,
  CollapsibleSection,
  ContactsHeroSection,
} from "@/components/navigator/dossier";
import { CompanyNotes } from "@/components/navigator/notes/CompanyNotes";
import { DossierErrorBoundary } from "@/components/navigator/shared/DossierErrorBoundary";
import { RecommendedActionBar } from "@/components/navigator/dossier/RecommendedActionBar";
import { useCompanyDossier } from "@/hooks/navigator/useCompanyDossier";
import { useExport } from "@/hooks/navigator/useExport";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";

export function SlideOverPane() {
  const selectedCompany = useStore((s) => s.selectedCompany);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const setSlideOverOpen = useStore((s) => s.setSlideOverOpen);
  const selectCompany = useStore((s) => s.selectCompany);
  const excludeCompany = useStore((s) => s.excludeCompany);
  const undoExclude = useStore((s) => s.undoExclude);
  const addUndoToast = useStore((s) => s.addUndoToast);
  const dossierScrollToTop = useStore((s) => s.dossierScrollToTop);
  const scrollToContactId = useStore((s) => s.scrollToContactId);
  const setScrollToContactId = useStore((s) => s.setScrollToContactId);
  const rawNotesByDomain = useStore((s) => s.notesByDomain);
  const dossier = useCompanyDossier(selectedCompanyDomain);
  const { executeExport } = useExport();
  const { notify } = useBrowserNotifications();
  const storeCompany = selectedCompany();

  // Detect stale dossier — if the selected domain changed but the
  // dossier still holds data for a previous domain, show skeleton
  const isDossierStale =
    selectedCompanyDomain != null &&
    dossier.company != null &&
    dossier.company.domain !== selectedCompanyDomain;
  const company = isDossierStale ? storeCompany : (dossier.company ?? storeCompany);
  const companyLoading = dossier.companyLoading || isDossierStale;
  const contactsLoading = dossier.contactsLoading;
  const signalsLoading = dossier.signalsLoading;
  const effectiveLoading = dossier.isLoading || isDossierStale;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [highlightFlash, setHighlightFlash] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const prevDossierLoading = useRef(dossier.isLoading);

  const notesCount = useMemo(() => {
    if (!company) return 0;
    return (rawNotesByDomain[company.domain] ?? []).length;
  }, [rawNotesByDomain, company]);

  // Track scroll position for jump-to-top button
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollTop(el.scrollTop > 300);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const handleScrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Auto-retry Apollo enrichment for exa-only companies
  const retryRef = useRef<string | null>(null);
  useEffect(() => {
    const c = dossier.company ?? storeCompany;
    if (
      c &&
      c.sources.length === 1 &&
      c.sources[0] === "exa" &&
      retryRef.current !== c.domain
    ) {
      retryRef.current = c.domain;
      dossier.refetch();
    }
  }, [dossier, storeCompany]);

  // Notify when dossier refresh completes
  useEffect(() => {
    if (prevDossierLoading.current && !dossier.isLoading && company) {
      notify("Dossier refreshed", `${company.name} data updated`);
    }
    prevDossierLoading.current = dossier.isLoading;
  }, [dossier.isLoading, company, notify]);

  // Show toast on dossier refresh failure
  const addToast = useStore((s) => s.addToast);
  const hadDataRef = useRef(false);
  useEffect(() => {
    if (company) hadDataRef.current = true;
  }, [company]);

  useEffect(() => {
    if (dossier.error && hadDataRef.current && !dossier.isLoading) {
      addToast({ message: "Failed to refresh dossier data", type: "error" });
    }
  }, [dossier.error, dossier.isLoading, addToast]);

  // Scroll to a specific contact when clicked from inline contacts on a card
  useEffect(() => {
    if (scrollToContactId && selectedCompanyDomain) {
      // Contacts are always visible now — just scroll to the element
      const timer = setTimeout(() => {
        const el = document.getElementById(`contact-${scrollToContactId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-1", "ring-accent-secondary/40");
          setTimeout(() => el.classList.remove("ring-1", "ring-accent-secondary/40"), 2000);
        }
        setScrollToContactId(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scrollToContactId, selectedCompanyDomain, setScrollToContactId]);

  // Scroll to top + flash highlight when dossierScrollToTop changes
  useEffect(() => {
    if (dossierScrollToTop > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      const flashTimer = requestAnimationFrame(() => setHighlightFlash(true));
      const clearTimer = setTimeout(() => setHighlightFlash(false), 600);
      return () => { cancelAnimationFrame(flashTimer); clearTimeout(clearTimer); };
    }
  }, [dossierScrollToTop]);

  if ((companyLoading && !storeCompany) || isDossierStale) return <DossierSkeleton />;

  if (dossier.companyError && !company) {
    return (
      <div className="flex h-full w-[420px] flex-shrink-0 flex-col items-center justify-center gap-3 bg-surface-0 px-6">
        <p className="text-sm text-text-secondary">
          Failed to load {selectedCompanyDomain ?? "company"}
        </p>
        <button
          onClick={() => dossier.refetch()}
          className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex h-full w-[420px] flex-shrink-0 items-center justify-center bg-surface-0">
        <p className="text-sm text-text-tertiary">Company not found</p>
      </div>
    );
  }

  const handleExclude = () => {
    excludeCompany(company.domain);
    addUndoToast(
      `Excluded ${company.name}`,
      () => undoExclude(company.domain),
      6000
    );
  };

  const signals = dossier.signals.length > 0 ? dossier.signals : (company.signals ?? []);

  return (
    <div className="relative h-full w-[420px] flex-shrink-0 bg-surface-0">
      <div
        ref={scrollContainerRef}
        className="flex h-full flex-col overflow-y-auto transition-shadow duration-500"
        style={highlightFlash ? { boxShadow: "inset 0 0 0 1px rgba(201, 162, 39, 0.25), inset 0 2px 8px rgba(201, 162, 39, 0.06)" } : undefined}
      >
        {/* Breadcrumb bar */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-surface-3 px-4 py-2.5">
          <nav className="flex min-w-0 items-center gap-1 text-xs" aria-label="Breadcrumb">
            <button
              onClick={() => setSlideOverOpen(false)}
              className="flex-shrink-0 text-text-tertiary transition-colors hover:text-accent-primary"
            >
              Results
            </button>
            <span className="flex-shrink-0 text-text-tertiary">/</span>
            <span className="min-w-0 truncate font-medium text-text-primary" aria-label={company.name}>
              {company.name}
            </span>
          </nav>
          <button
            onClick={() => selectCompany(null)}
            className="ml-2 flex-shrink-0 text-text-tertiary transition-colors hover:text-text-primary"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Compact header */}
        <DossierCompactHeader
          key={company.domain}
          company={company}
          onRefresh={dossier.refetch}
          isRefreshing={companyLoading}
        />

        <div className="flex-1">
          {/* Recommended Action Bar */}
          <div className="animate-fadeInUp px-4" style={{ animationDelay: "0ms" }}>
            <DossierErrorBoundary sectionName="Recommendations">
              <RecommendedActionBar company={company} contacts={dossier.contacts} />
            </DossierErrorBoundary>
          </div>

          {/* HERO: Contacts Section */}
          <div className="animate-fadeInUp" style={{ animationDelay: "60ms" }}>
            <DossierErrorBoundary sectionName="Contacts">
              <ContactsHeroSection
                contacts={dossier.contacts}
                domain={company.domain}
                isLoading={contactsLoading}
                contactsError={dossier.contactsError}
              />
            </DossierErrorBoundary>
          </div>

          {/* Collapsible: Freshsales CRM */}
          <div className="animate-fadeInUp" style={{ animationDelay: "120ms" }}>
            <DossierErrorBoundary sectionName="Freshsales">
              <CollapsibleSection
                title="Freshsales CRM"
                defaultOpen={company.freshsalesStatus !== "none" && company.freshsalesStatus !== undefined}
                persistKey="freshsales"
              >
                <DossierFreshsales company={company} />
              </CollapsibleSection>
            </DossierErrorBoundary>
          </div>

          {/* Collapsible: Company Overview */}
          <div className="animate-fadeInUp" style={{ animationDelay: "180ms" }}>
            <DossierErrorBoundary sectionName="Overview">
              <CollapsibleSection title="Company Overview" persistKey="overview">
                <DossierOverview company={company} />
              </CollapsibleSection>
            </DossierErrorBoundary>
          </div>

          {/* Collapsible: Signals & News */}
          <div className="animate-fadeInUp" style={{ animationDelay: "240ms" }}>
            <DossierErrorBoundary sectionName="Signals">
              <CollapsibleSection title="Signals & News" count={signals.length} persistKey="signals">
                <DossierSignals signals={signals} isLoading={signalsLoading} error={dossier.signalsError} />
              </CollapsibleSection>
            </DossierErrorBoundary>
          </div>

          {/* Collapsible: HubSpot */}
          <div className="animate-fadeInUp" style={{ animationDelay: "300ms" }}>
            <DossierErrorBoundary sectionName="HubSpot">
              <CollapsibleSection title="HubSpot" persistKey="hubspot">
                <DossierHubspot company={company} />
              </CollapsibleSection>
            </DossierErrorBoundary>
          </div>

          {/* Collapsible: Similar Companies */}
          <div className="animate-fadeInUp" style={{ animationDelay: "360ms" }}>
            <DossierErrorBoundary sectionName="Similar Companies">
              <CollapsibleSection title="Similar Companies" persistKey="similar">
                <DossierSimilarCompanies domain={company.domain} employeeCount={company.employeeCount} region={company.region} />
              </CollapsibleSection>
            </DossierErrorBoundary>
          </div>

          {/* Collapsible: Notes */}
          <div className="animate-fadeInUp" style={{ animationDelay: "420ms" }}>
            <DossierErrorBoundary sectionName="Notes">
              <CollapsibleSection title="Notes" count={notesCount} persistKey="notes">
                <CompanyNotes companyDomain={company.domain} />
              </CollapsibleSection>
            </DossierErrorBoundary>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="flex flex-shrink-0 items-center gap-2 border-t border-surface-3 px-4 py-3">
          <button
            onClick={handleExclude}
            className="btn-press rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
          >
            Mark Excluded
          </button>
          <button
            onClick={() => executeExport(dossier.contacts, "clipboard")}
            disabled={dossier.contacts.length === 0}
            title={dossier.contacts.length === 0 ? (contactsLoading ? "Loading contacts..." : "No contacts available to export") : undefined}
            className="btn-press rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {contactsLoading && dossier.contacts.length === 0
              ? "Loading..."
              : `Export All${dossier.contacts.length > 0 ? ` (${dossier.contacts.length})` : ""}`}
          </button>
        </div>
      </div>

      {/* Jump-to-top floating button */}
      {showScrollTop && (
        <button
          onClick={handleScrollToTop}
          className="absolute bottom-16 right-4 z-20 flex items-center gap-1 rounded-full border border-surface-3 bg-surface-2 p-2 text-text-tertiary shadow-lg transition-all duration-[180ms] hover:text-text-primary hover:bg-surface-3"
          aria-label="Scroll to top"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span className="text-[10px] font-medium">Top</span>
        </button>
      )}
    </div>
  );
}
