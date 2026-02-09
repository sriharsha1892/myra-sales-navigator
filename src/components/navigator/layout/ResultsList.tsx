"use client";

import { cn } from "@/lib/cn";
import { useStore } from "@/lib/navigator/store";
import { CompanyCard } from "@/components/navigator/cards/CompanyCard";
import { InlineContacts } from "@/components/navigator/cards/InlineContacts";
import { SkeletonCard } from "@/components/navigator/cards/SkeletonCard";
import { ViewToggle, QuickFilterChips, ResultFilterChips, EmptyState } from "@/components/navigator/shared";
import { ActiveFilterPills } from "@/components/navigator/shared/ActiveFilterPills";
import type { SortField, CompanyEnriched, ResultSource } from "@/lib/navigator/types";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { useExport } from "@/hooks/navigator/useExport";
import { MyProspects } from "./MyProspects";
import { pick } from "@/lib/navigator/ui-copy";
import { pLimit } from "@/lib/utils";
import { ExportedContactsPanel } from "@/components/navigator/exports/ExportedContactsPanel";
import { AllContactsView } from "./AllContactsView";
import { SessionStarterCard } from "@/components/navigator/home/SessionStarterCard";
import { FollowUpNudges } from "@/components/navigator/shared/FollowUpNudges";
import { CreditUsageIndicator } from "@/components/navigator/CreditUsageIndicator";
import { DueStepsWidget } from "@/components/navigator/outreach/DueStepsWidget";
import { Tooltip } from "@/components/navigator/shared/Tooltip";

const exampleQueries = [
  "chemicals in Europe",
  "SaaS hiring in US",
  "food ingredients expanding to Asia",
  "Brenntag",
  "logistics companies",
  "BASF SE",
];

export function ResultsList() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const sortField = useStore((s) => s.sortField);
  const sortDirection = useStore((s) => s.sortDirection);
  const setSortField = useStore((s) => s.setSortField);
  const setSortDirection = useStore((s) => s.setSortDirection);
  const searchError = useStore((s) => s.searchError);
  const searchResults = useStore((s) => s.searchResults);
  const searchLoading = useStore((s) => s.searchLoading);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const resultGrouping = useStore((s) => s.resultGrouping);
  const setResultGrouping = useStore((s) => s.setResultGrouping);

  const setFilters = useStore((s) => s.setFilters);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);
  const lastICPCriteria = useStore((s) => s.lastICPCriteria);
  const { history } = useSearchHistory();

  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const toggleCompanySelection = useStore((s) => s.toggleCompanySelection);
  const sessionCompaniesReviewed = useStore((s) => s.sessionCompaniesReviewed);
  const sessionContactsExported = useStore((s) => s.sessionContactsExported);
  const expandedContactsDomain = useStore((s) => s.expandedContactsDomain);
  const allContactsViewActive = useStore((s) => s.allContactsViewActive);
  const setAllContactsViewActive = useStore((s) => s.setAllContactsViewActive);
  const presets = useStore((s) => s.presets);
  const lastExcludedCount = useStore((s) => s.lastExcludedCount);
  const deselectAllCompanies = useStore((s) => s.deselectAllCompanies);
  const activeResultIndex = useStore((s) => s.activeResultIndex);
  const triageFilter = useStore((s) => s.triageFilter);
  const setTriageFilter = useStore((s) => s.setTriageFilter);
  const companyDecisions = useStore((s) => s.companyDecisions);
  const prospectList = useStore((s) => s.prospectList);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const setContactsForDomain = useStore((s) => s.setContactsForDomain);
  const triggerExpressExport = useStore((s) => s.triggerExpressExport);
  const setTriggerExpressExport = useStore((s) => s.setTriggerExpressExport);
  const addToast = useStore((s) => s.addToast);
  const { executeExport } = useExport();

  const scrollRef = useRef<HTMLDivElement>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [relatedCollapsed, setRelatedCollapsed] = useState(true);
  const [previousResultCount, setPreviousResultCount] = useState(6);

  const companies = filteredCompanies();

  const highFitCompanies = useMemo(
    () => companies.filter((c) => c.icpScore >= 70),
    [companies]
  );

  const handleExpressExport = useCallback(async () => {
    if (highFitCompanies.length === 0) {
      addToast({ message: "No high-fit companies (ICP 70+) to export", type: "warning" });
      return;
    }

    // Gather contacts — fetch missing ones first
    const missingDomains = highFitCompanies.filter(
      (c) => !contactsByDomain[c.domain]?.length
    );

    if (missingDomains.length > 0) {
      const handle = useStore.getState().addProgressToast(`Loading contacts for ${missingDomains.length} companies...`);
      const limit = pLimit(3);
      await Promise.all(
        missingDomains.map((company) =>
          limit(async () => {
            try {
              const nameParam = company.name && company.name !== company.domain
                ? `?name=${encodeURIComponent(company.name)}`
                : "";
              const res = await fetch(
                `/api/company/${encodeURIComponent(company.domain)}/contacts${nameParam}`
              );
              if (!res.ok) return;
              const data = await res.json();
              if (data.contacts?.length) {
                useStore.getState().setContactsForDomain(company.domain, data.contacts);
              }
            } catch { /* silent */ }
          })
        )
      );
      handle.resolve("Contacts loaded");
    }

    // Re-read contacts from store (may have been updated by fetches above)
    const currentStore = useStore.getState();
    const allContacts = highFitCompanies.flatMap(
      (c) => currentStore.contactsByDomain[c.domain] ?? []
    );
    const contactsWithEmail = allContacts.filter((c) => c.email);

    if (contactsWithEmail.length === 0) {
      addToast({ message: "No contacts with email found for high-fit companies", type: "warning" });
      return;
    }

    executeExport(contactsWithEmail, "clipboard");
  }, [highFitCompanies, contactsByDomain, addToast, executeExport]);

  // Watch for Cmd+Shift+E trigger
  useEffect(() => {
    if (triggerExpressExport) {
      setTriggerExpressExport(false);
      handleExpressExport();
    }
  }, [triggerExpressExport, setTriggerExpressExport, handleExpressExport]);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("nav_onboarded")) {
      setShowOnboarding(true);
    }
  }, []);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setRelatedCollapsed(true); // Reset collapsed state on new search
    if (searchResults && searchResults.length > 0) {
      setPreviousResultCount(Math.min(searchResults.length, 10));
    }
  }, [searchResults]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("nav_onboarded", "1");
  };

  const hasSearched = searchResults !== null;

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const quickStartChips = history.length > 0
    ? history.slice(0, 6).map((h) => ({ label: h.label ?? "Search", onClick: () => {
        const f = h.filters;
        const hasFilters = f && (
          (f.verticals?.length > 0) ||
          (f.regions?.length > 0) ||
          (f.sizes?.length > 0) ||
          (f.signals?.length > 0)
        );
        if (hasFilters) {
          setFilters(f);
          setPendingFilterSearch(true);
        } else {
          setPendingFreeTextSearch(h.label ?? "");
        }
      }}))
    : exampleQueries.map((q) => ({ label: q, onClick: () => setPendingFreeTextSearch(q) }));

  return (
    <div className="flex h-full flex-col bg-surface-0">
      {/* Top bar */}
      <div className="ambient-header relative bg-surface-0 border-b border-surface-3 flex flex-shrink-0 flex-wrap items-center gap-3 px-4 py-2.5">
        {searchLoading && (
          <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-accent-primary/10">
            <div className="h-full w-1/4 bg-accent-primary" style={{ animation: "progressSlide 1.2s ease-in-out infinite" }} />
          </div>
        )}
        <ViewToggle
          value={viewMode}
          onChange={(mode) => { setViewMode(mode); if (mode !== "companies") setAllContactsViewActive(false); }}
          companyCount={companies.length}
          prospectCount={prospectList.size}
        />
        {viewMode === "companies" && hasSearched && !searchLoading && (
          <>
            <div className="h-3.5 w-px bg-surface-3" />
            <button
              onClick={() => setAllContactsViewActive(!allContactsViewActive)}
              className={`flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs transition-all duration-[180ms] ${
                allContactsViewActive
                  ? "border-accent-secondary/40 bg-accent-secondary/10 font-semibold text-accent-secondary"
                  : "border-surface-3 text-text-tertiary hover:border-accent-secondary/30 hover:text-text-secondary"
              }`}
            >
              All Contacts
            </button>
          </>
        )}
        {viewMode === "companies" && hasSearched && !searchLoading && highFitCompanies.length > 0 && (
          <>
            <div className="h-3.5 w-px bg-surface-3" />
            <Tooltip text="Export all contacts from ICP 70+ companies (Cmd+Shift+E)">
              <button
                onClick={handleExpressExport}
                className="flex items-center gap-1.5 rounded-pill border border-accent-primary/30 bg-accent-primary/10 px-2.5 py-1 text-xs font-medium text-accent-primary transition-all duration-[180ms] hover:bg-accent-primary/20 hover:border-accent-primary/50"
              >
                Export &#x2605;70+ ({highFitCompanies.length})
              </button>
            </Tooltip>
          </>
        )}
        {/* Triage filter chips */}
        {viewMode === "companies" && hasSearched && !searchLoading && Object.keys(companyDecisions).length > 0 && (
          <>
            <div className="h-3.5 w-px bg-surface-3" />
            <div className="flex items-center gap-1">
              {(["all", "unreviewed", "interested"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTriageFilter(f)}
                  className={cn(
                    "rounded-pill px-2 py-0.5 text-[10px] font-medium transition-all duration-[180ms]",
                    triageFilter === f
                      ? "bg-surface-2 text-text-primary"
                      : "text-text-tertiary hover:text-text-secondary"
                  )}
                >
                  {f === "all" ? "All" : f === "unreviewed" ? "Unreviewed" : "Interested"}
                </button>
              ))}
            </div>
          </>
        )}
        {/* M1: Bulk selection count indicator */}
        {selectedCompanyDomains.size > 0 && (
          <>
            <div className="h-3.5 w-px bg-surface-3" />
            <span className="flex items-center gap-1.5 rounded-pill bg-accent-primary/10 px-2 py-0.5 text-xs text-accent-primary">
              {selectedCompanyDomains.size} selected
              <button
                onClick={() => deselectAllCompanies()}
                className="ml-0.5 text-accent-primary/60 transition-colors hover:text-accent-primary"
                aria-label="Clear selection"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          </>
        )}
        {viewMode === "companies" && companies.length > 0 && (() => {
          const avg = Math.round(companies.reduce((s, c) => s + c.icpScore, 0) / companies.length);
          const color = avg >= 70 ? "bg-success/15 text-success border-success/30" : avg >= 50 ? "bg-warning/15 text-warning border-warning/30" : "bg-surface-2 text-text-tertiary border-surface-3";
          return (
            <span className={`rounded-pill border px-2.5 py-1 font-mono text-xs font-semibold ${color}`}>
              Avg: {avg}
            </span>
          );
        })()}
        <div className="ml-auto flex items-center gap-3">
          {viewMode === "companies" && (
            <>
              {/* Sort — dot-separated text links */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase tracking-[0.06em] text-text-secondary">Sort</span>
                <div className="flex items-center">
                  {(["icp_score", "name", "employee_count"] as SortField[]).map((field, i) => {
                    const labels: Record<SortField, string> = { icp_score: "Score", name: "Name", employee_count: "Size", relevance: "Relevance" };
                    const sortIcons: Record<SortField, string> = { icp_score: "\u2605", name: "Az", employee_count: "\u2195", relevance: "\u2261" };
                    const isActive = sortField === field;
                    return (
                      <span key={field} className="flex items-center">
                        {i > 0 && <span className="mx-1 text-text-tertiary/40">·</span>}
                        <button
                          onClick={() => handleSortChange(field)}
                          className={`rounded px-1.5 py-0.5 text-xs transition-all duration-[180ms] ${
                            isActive
                              ? "bg-surface-2 font-semibold text-text-primary"
                              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                          }`}
                        >
                          <span className="mr-0.5 opacity-60">{sortIcons[field]}</span>{labels[field]}
                        </button>
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
                  className="btn-press text-xs text-text-tertiary hover:text-text-primary transition-colors duration-[180ms]"
                  aria-label={sortDirection === "desc" ? "Descending" : "Ascending"}
                >
                  {sortDirection === "desc" ? "\u2193" : "\u2191"}
                </button>
              </div>
              {/* Group — dot-separated text links */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase tracking-[0.06em] text-text-secondary">Group</span>
                <div className="flex items-center">
                  {(["icp_tier", "source", "none"] as const).map((g, i) => {
                    const labels = { icp_tier: "Tier", source: "Source", none: "Flat" };
                    const isActive = resultGrouping === g;
                    return (
                      <span key={g} className="flex items-center">
                        {i > 0 && <span className="mx-1 text-text-tertiary/40">·</span>}
                        <button
                          onClick={() => setResultGrouping(g)}
                          className={`rounded px-1.5 py-0.5 text-xs transition-all duration-[180ms] ${
                            isActive
                              ? "bg-surface-2 font-semibold text-text-primary"
                              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                          }`}
                        >
                          {labels[g]}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <CreditUsageIndicator />
        </div>
      </div>

      {/* Persistent search query header — visible during loading and after results */}
      {(hasSearched || searchLoading) && lastSearchQuery && (
        <div className="sticky top-0 z-20 flex flex-shrink-0 items-center gap-2 border-b border-surface-3 bg-surface-1/80 backdrop-blur-sm px-4 py-1.5">
          <span className="text-xs text-text-tertiary">Results for</span>
          <span className="font-mono text-xs text-text-secondary">&ldquo;{lastSearchQuery}&rdquo;</span>
          {!searchLoading && companies.length > 0 && (
            <span className="text-xs text-text-tertiary">
              ({companies.length} companies{lastExcludedCount > 0 ? `, ${lastExcludedCount} excluded` : ""})
            </span>
          )}
        </div>
      )}

      {/* ICP criteria banner */}
      {lastICPCriteria && !searchLoading && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-accent-primary/20 bg-accent-primary/5 px-4 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-primary">ICP</span>
          <span className="text-xs text-text-secondary">{lastICPCriteria.description}</span>
          {lastICPCriteria.targetVerticals.length > 0 && (
            <div className="flex gap-1">
              {lastICPCriteria.targetVerticals.slice(0, 3).map((v) => (
                <span key={v} className="rounded-pill bg-accent-primary/10 px-1.5 py-0.5 text-[9px] text-accent-primary">{v}</span>
              ))}
            </div>
          )}
          {lastICPCriteria.targetRegions.length > 0 && (
            <div className="flex gap-1">
              {lastICPCriteria.targetRegions.slice(0, 3).map((r) => (
                <span key={r} className="rounded-pill bg-accent-secondary/10 px-1.5 py-0.5 text-[9px] text-accent-secondary">{r}</span>
              ))}
            </div>
          )}
          {lastICPCriteria.buyingSignals.length > 0 && (
            <div className="flex gap-1">
              {lastICPCriteria.buyingSignals.slice(0, 2).map((s) => (
                <span key={s} className="rounded-pill bg-success/10 px-1.5 py-0.5 text-[9px] text-success">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky filter pill bar — visible on both tabs after search */}
      {(hasSearched || searchLoading) && (
        <div className="sticky top-0 z-10 flex flex-shrink-0 flex-col gap-1 border-b border-surface-3 bg-surface-0 px-4 py-2">
          <ActiveFilterPills />
          {viewMode === "companies" && !searchLoading && (
            <div className="flex flex-wrap gap-1.5">
              <QuickFilterChips />
              <ResultFilterChips />
            </div>
          )}
        </div>
      )}

      {/* Error banner — sticky so it stays visible while scrolling */}
      {searchError && (
        <div className="sticky top-0 z-20 flex-shrink-0 border-b border-danger/20 bg-danger-light px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-danger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{searchError}</span>
          </div>
        </div>
      )}

      {/* Results */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 transition-opacity duration-200">
        {/* Loading skeletons */}
        {searchLoading ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-3 rounded-card border border-surface-3 bg-surface-1/60 px-4 py-5 mb-3">
              <svg className="h-5 w-5 animate-spin text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-text-primary">Searching...</span>
            </div>
            <ContextualLoadingMessage />
            {Array.from({ length: previousResultCount }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : viewMode === "exported" ? (
          /* ======== Exported contacts view (works pre-search too) ======== */
          <ExportedContactsPanel />
        ) : viewMode === "prospect_list" ? (
          /* ======== Prospect list view ======== */
          <ProspectListView />
        ) : !hasSearched ? (
          /* Welcome state — before first search */
          <div className="flex h-full flex-col items-center justify-center">
            {showOnboarding && (
              <OnboardingTour onDismiss={dismissOnboarding} />
            )}
            <SessionStarterCard />
            <FollowUpNudges />
            <h2 className="animate-fadeInUp font-display text-2xl text-text-primary" style={{ animationDelay: "0ms" }}>
              Search for companies
            </h2>
            <p className="animate-fadeInUp mt-2 text-sm text-text-secondary" style={{ animationDelay: "60ms" }}>
              A specific company, an industry, or a description of your ideal prospect
            </p>

            {sessionCompaniesReviewed > 0 && (
              <p className="animate-fadeInUp mt-1.5 text-xs text-text-tertiary" style={{ animationDelay: "100ms" }}>
                This session: reviewed {sessionCompaniesReviewed} companies{sessionContactsExported > 0 ? `, exported ${sessionContactsExported} contacts` : ""}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {quickStartChips.map((chip, i) => (
                <button
                  key={`${chip.label}-${i}`}
                  onClick={chip.onClick}
                  className="btn-press animate-fadeInUp rounded-pill border border-surface-3 bg-surface-1 px-5 py-2.5 text-sm font-medium text-text-secondary shadow-sm transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-md hover:text-text-primary"
                  style={{ animationDelay: `${120 + i * 60}ms` }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Team presets */}
            {presets.length > 0 && (
              <div className="mt-6 w-full max-w-lg animate-fadeInUp" style={{ animationDelay: "400ms" }}>
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Team Presets</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {presets.slice(0, 6).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setFilters(preset.filters);
                        setPendingFilterSearch(true);
                      }}
                      className="rounded-pill border border-accent-primary/20 bg-accent-primary/5 px-3 py-1.5 text-xs text-accent-primary transition-colors hover:bg-accent-primary/10 hover:border-accent-primary/40"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Steps due today */}
            <div className="mt-6 w-full max-w-lg animate-fadeInUp" style={{ animationDelay: "460ms" }}>
              <DueStepsWidget />
            </div>
            <div className="mt-8 flex w-full justify-center">
              <MyProspects />
            </div>
          </div>
        ) : allContactsViewActive && viewMode === "companies" ? (
          <AllContactsView />
        ) : viewMode === "companies" ? (
          companies.length === 0 ? (
            searchError ? (
              <EmptyState
                icon="search"
                title="Search failed"
                description="Something went wrong with the search. Check the error above and try again."
              />
            ) : (
              <NoResultsSuggestions />
            )
          ) : (
            <div
              role="listbox"
              aria-label="Company results"
              aria-activedescendant={
                selectedCompanyDomain ? `company-${selectedCompanyDomain}` : undefined
              }
              tabIndex={0}
              className="space-y-1.5 focus:outline-none"
            >
              {(() => {
                // M2: Build a domain→searchResults index map for data-result-index
                const domainToResultIndex = new Map<string, number>();
                if (searchResults) {
                  searchResults.forEach((c, i) => domainToResultIndex.set(c.domain, i));
                }

                // Helper: renders a CompanyCard + inline contacts accordion
                const renderCompanyItem = (company: CompanyEnriched, idx: number) => {
                  const resultIdx = domainToResultIndex.get(company.domain);
                  const isActiveResult = activeResultIndex != null && resultIdx === activeResultIndex;
                  return (
                    <div
                      key={company.domain}
                      data-result-index={resultIdx}
                      className={`animate-fadeInUp${isActiveResult ? " ring-1 ring-accent-secondary/40 rounded-card" : ""}`}
                      style={{ animationDelay: `${Math.min(idx, 10) * 40}ms` }}
                    >
                      <CompanyCard
                        company={company}
                        isSelected={selectedCompanyDomain === company.domain}
                        isChecked={selectedCompanyDomains.has(company.domain)}
                        onSelect={() => selectCompany(company.domain)}
                        onToggleCheck={() => toggleCompanySelection(company.domain)}
                      />
                      {expandedContactsDomain === company.domain && (
                        <InlineContacts domain={company.domain} companyName={company.name} />
                      )}
                    </div>
                  );
                };

                if (resultGrouping === "icp_tier") {
                  const tiers = [
                    { label: "Strong fit", min: 80, max: 100, color: "text-accent-highlight" },
                    { label: "Good fit", min: 60, max: 79, color: "text-accent-primary" },
                    { label: "Possible", min: 40, max: 59, color: "text-warning" },
                    { label: "Review", min: 0, max: 39, color: "text-text-tertiary" },
                  ] as const;
                  let globalIdx = 0;
                  return tiers.map((tier) => {
                    const tierCompanies = companies.filter(
                      (c) => c.icpScore >= tier.min && c.icpScore <= tier.max
                    );
                    if (tierCompanies.length === 0) return null;
                    return (
                      <div key={tier.label}>
                        <div className="sticky top-0 z-10 rounded bg-surface-0 px-1 py-1.5">
                          <span className={`text-sm font-semibold uppercase tracking-wide ${tier.color}`}>
                            {tier.label}
                          </span>
                          <span className="ml-1.5 font-mono text-[10px] text-text-tertiary">
                            {tier.min}–{tier.max} ({tierCompanies.length})
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {tierCompanies.map((company) => renderCompanyItem(company, globalIdx++))}
                        </div>
                      </div>
                    );
                  });
                }

                if (resultGrouping === "source") {
                  const exaCompanies = companies.filter((c) => c.sources.includes("exa" as ResultSource));
                  const apolloOnly = companies.filter((c) => !c.sources.includes("exa" as ResultSource));
                  let globalIdx = 0;
                  return (
                    <>
                      {exaCompanies.length > 0 && (
                        <div>
                          <div className="sticky top-0 z-10 rounded bg-surface-0 px-1 py-1.5">
                            <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-source-exa)" }}>
                              Discovered via Exa
                            </span>
                            <span className="ml-1.5 font-mono text-[10px] text-text-tertiary">
                              ({exaCompanies.length})
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {exaCompanies.map((company) => renderCompanyItem(company, globalIdx++))}
                          </div>
                        </div>
                      )}
                      {apolloOnly.length > 0 && (
                        <div>
                          <div className="sticky top-0 z-10 rounded bg-surface-0 px-1 py-1.5">
                            <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-source-apollo)" }}>
                              Enriched via Apollo
                            </span>
                            <span className="ml-1.5 font-mono text-[10px] text-text-tertiary">
                              ({apolloOnly.length})
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {apolloOnly.map((company) => renderCompanyItem(company, globalIdx++))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                }

                // Flat / "none" grouping
                const exactMatch = companies.find((c) => c.exactMatch);
                const related = exactMatch ? companies.filter((c) => !c.exactMatch) : [];
                const showExactMatchSection = !!exactMatch && related.length > 0;

                return showExactMatchSection ? (
                  <>
                    {/* Exact match */}
                    <div className="animate-fadeInUp">
                      <div className="mb-1 px-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-primary">Exact match</span>
                      </div>
                      <CompanyCard
                        company={exactMatch}
                        isSelected={selectedCompanyDomain === exactMatch.domain}
                        isChecked={selectedCompanyDomains.has(exactMatch.domain)}
                        onSelect={() => selectCompany(exactMatch.domain)}
                        onToggleCheck={() => toggleCompanySelection(exactMatch.domain)}
                      />
                      {expandedContactsDomain === exactMatch.domain && (
                        <InlineContacts domain={exactMatch.domain} companyName={exactMatch.name} />
                      )}
                    </div>

                    {/* Related companies — collapsed by default */}
                    <div className="mt-3">
                      <button
                        onClick={() => setRelatedCollapsed(!relatedCollapsed)}
                        className="flex items-center gap-1.5 px-1 py-1 text-text-secondary hover:text-text-primary"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`flex-shrink-0 transition-transform duration-[180ms] ${relatedCollapsed ? "-rotate-90" : ""}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                          {related.length} related compan{related.length === 1 ? "y" : "ies"}
                        </span>
                        {relatedCollapsed && (
                          <span className="text-[10px] text-accent-secondary">click to expand</span>
                        )}
                      </button>
                      {!relatedCollapsed && (
                        <div className="mt-1 space-y-1.5">
                          {related.map((company, index) => renderCompanyItem(company, index))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  companies.map((company, index) => renderCompanyItem(company, index))
                );
              })()}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Onboarding Tour (I3) — 3-step walkthrough
// ─────────────────────────────────────────────────────────
function OnboardingTour({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Search", body: "Type a company name, industry, or description in the search bar above. Or press \u2318K for a powerful free-text search." },
    { title: "Filter", body: "Use the filter pills above the results to narrow by vertical, region, company size, and buying signals. Or press ⌘K to refine your search." },
    { title: "Export", body: "Select companies with checkboxes, then use Copy/CSV/Excel from the action bar at the bottom. Contacts are verified on export." },
  ];

  return (
    <div className="mb-6 w-full max-w-lg animate-fadeInUp rounded-card border border-surface-3 bg-surface-1 px-5 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-accent-primary" : "bg-surface-3"}`} />
        ))}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-primary">{steps[step].title}</p>
      <p className="mt-1 text-sm text-text-secondary">{steps[step].body}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-text-tertiary">{step + 1} of {steps.length}</span>
        <div className="flex gap-2">
          <button onClick={onDismiss} className="text-xs text-text-tertiary hover:text-text-secondary">Skip</button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="rounded-input bg-accent-primary px-3 py-1 text-xs font-medium text-text-inverse">Next</button>
          ) : (
            <button onClick={onDismiss} className="rounded-input bg-accent-primary px-3 py-1 text-xs font-medium text-text-inverse">Get started</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Contextual Loading Message (A1) — cycles through source-specific messages
// ─────────────────────────────────────────────────────────
function ContextualLoadingMessage() {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = useMemo(() => [
    pick("search_loading_exa"),
    pick("search_loading_apollo"),
    pick("search_loading_hubspot"),
    pick("search_loading"),
  ], []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <p className="mb-2 text-xs text-text-tertiary transition-opacity duration-200">
      {messages[messageIndex]}
    </p>
  );
}

// ─────────────────────────────────────────────────────────
// Prospect List View — persistent list across searches
// ─────────────────────────────────────────────────────────
function ProspectListView() {
  const prospectList = useStore((s) => s.prospectList);
  const removeFromProspectList = useStore((s) => s.removeFromProspectList);
  const clearProspectList = useStore((s) => s.clearProspectList);
  const searchResults = useStore((s) => s.searchResults);
  const companies = useStore((s) => s.companies);
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const setTriggerExport = useStore((s) => s.setTriggerExport);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const toggleCompanySelection = useStore((s) => s.toggleCompanySelection);
  const expandedContactsDomain = useStore((s) => s.expandedContactsDomain);

  const domains = useMemo(() => [...prospectList], [prospectList]);

  // Build company data from search results or companies array
  const prospectCompanies = useMemo(() => {
    const all = searchResults ?? companies;
    const byDomain = new Map(all.map((c) => [c.domain, c]));
    return domains
      .map((d) => byDomain.get(d))
      .filter((c): c is import("@/lib/navigator/types").CompanyEnriched => !!c);
  }, [domains, searchResults, companies]);

  if (domains.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No companies in your list"
        description="Add companies to your list using the bookmark icon on company cards. Your list persists across searches and sessions."
      />
    );
  }

  const totalContacts = prospectCompanies.reduce(
    (sum, c) => sum + (contactsByDomain[c.domain]?.length ?? 0),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          {prospectCompanies.length} companies · {totalContacts} contacts loaded
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={clearProspectList}
            className="text-[10px] text-danger/70 hover:text-danger"
          >
            Clear list
          </button>
        </div>
      </div>
      <div role="listbox" aria-label="Prospect list" className="space-y-1.5">
        {prospectCompanies.map((company, idx) => (
          <div key={company.domain} className="animate-fadeInUp" style={{ animationDelay: `${Math.min(idx, 10) * 40}ms` }}>
            <CompanyCard
              company={company}
              isSelected={selectedCompanyDomain === company.domain}
              isChecked={selectedCompanyDomains.has(company.domain)}
              onSelect={() => selectCompany(company.domain)}
              onToggleCheck={() => toggleCompanySelection(company.domain)}
            />
            {expandedContactsDomain === company.domain && (
              <InlineContacts domain={company.domain} companyName={company.name} />
            )}
          </div>
        ))}
      </div>
      {/* Show domains not found in current results */}
      {domains.length > prospectCompanies.length && (
        <div className="rounded-card border border-surface-3 bg-surface-1 p-3">
          <p className="text-xs text-text-tertiary">
            {domains.length - prospectCompanies.length} companies not in current results.
            Search for them to see full details.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {domains
              .filter((d) => !prospectCompanies.some((c) => c.domain === d))
              .map((d) => (
                <span key={d} className="flex items-center gap-1 rounded-pill border border-surface-3 bg-surface-2 px-2 py-0.5 text-[10px] text-text-secondary">
                  {d}
                  <button
                    onClick={() => removeFromProspectList(d)}
                    className="text-text-tertiary hover:text-danger"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// No Results Suggestions (A2) — actionable filter removal buttons
// ─────────────────────────────────────────────────────────
function NoResultsSuggestions() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);

  const suggestions: { label: string; action: () => void }[] = [];

  if (filters.verticals.length > 0) {
    suggestions.push({
      label: `Remove ${filters.verticals.length} vertical filter${filters.verticals.length > 1 ? "s" : ""}`,
      action: () => { setFilters({ verticals: [] }); setPendingFilterSearch(true); },
    });
  }
  if (filters.regions.length < 5 && filters.regions.length > 0) {
    suggestions.push({
      label: "Include all regions",
      action: () => { setFilters({ regions: ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"] }); setPendingFilterSearch(true); },
    });
  }
  if (filters.sizes.length < 4 && filters.sizes.length > 0) {
    suggestions.push({
      label: "Include all company sizes",
      action: () => { setFilters({ sizes: ["1-50", "51-200", "201-1000", "1000+"] }); setPendingFilterSearch(true); },
    });
  }

  return (
    <EmptyState
      icon="search"
      title="No matches found"
      description={pick("empty_results")}
    >
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={s.action}
              className="rounded-pill border border-surface-3 bg-surface-1 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-text-primary"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </EmptyState>
  );
}

