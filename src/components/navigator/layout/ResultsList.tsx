"use client";

import { useStore } from "@/lib/navigator/store";
import { CompanyCard } from "@/components/navigator/cards/CompanyCard";
import { InlineContacts } from "@/components/navigator/cards/InlineContacts";
import { SkeletonCard } from "@/components/navigator/cards/SkeletonCard";
import { EmptyState } from "@/components/navigator/shared";
import type { SortField, CompanyEnriched, ViewMode } from "@/lib/navigator/types";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { pick } from "@/lib/navigator/ui-copy";
import { ExportedContactsPanel } from "@/components/navigator/exports/ExportedContactsPanel";
import { AllContactsView } from "./AllContactsView";
import { SessionStarterCard } from "@/components/navigator/home/SessionStarterCard";
import { SimilarSearchBanner } from "@/components/navigator/banners/SimilarSearchBanner";
import { ResultsTabBar } from "./ResultsTabBar";
import { ResultsHeader } from "./ResultsHeader";
import { CompanyTable } from "@/components/navigator/table/CompanyTable";
import { QuickFilterBar } from "@/components/navigator/shared/QuickFilterBar";
import { SEED_COMPANIES, SEED_CONTACTS } from "@/lib/navigator/seed-data";

const EXAMPLE_CATEGORIES = [
  { label: "Exact Company", examples: ["BASF SE", "Brenntag", "Evonik"] },
  { label: "Industry + Region", examples: ["SaaS companies in EMEA", "chemicals in Europe", "food ingredients North America"] },
  { label: "With Signals", examples: ["tech companies hiring VPs in US", "packaging companies funding round", "polymer manufacturers hiring"] },
  { label: "Multi-criteria", examples: ["mid-size pharma expanding Asia with funding", "specialty chemicals North America", "agricultural distributors Latin America"] },
];

const ALL_EXAMPLE_QUERIES = EXAMPLE_CATEGORIES.flatMap((c) => c.examples);

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
  const setFilters = useStore((s) => s.setFilters);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);
  const { history } = useSearchHistory();

  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const toggleCompanySelection = useStore((s) => s.toggleCompanySelection);
  const expandedContactsDomain = useStore((s) => s.expandedContactsDomain);
  const allContactsViewActive = useStore((s) => s.allContactsViewActive);
  const setAllContactsViewActive = useStore((s) => s.setAllContactsViewActive);
  const presets = useStore((s) => s.presets);
  const loadPreset = useStore((s) => s.loadPreset);
  const lastExcludedCount = useStore((s) => s.lastExcludedCount);
  const deselectAllCompanies = useStore((s) => s.deselectAllCompanies);
  const activeResultIndex = useStore((s) => s.activeResultIndex);
  const prospectList = useStore((s) => s.prospectList);
  const demoMode = useStore((s) => s.demoMode);
  const setContactsForDomain = useStore((s) => s.setContactsForDomain);
  const relevanceFeedback = useStore((s) => s.relevanceFeedback);
  const showHiddenResults = useStore((s) => s.showHiddenResults);
  const setShowHiddenResults = useStore((s) => s.setShowHiddenResults);
  const similarResults = useStore((s) => s.similarResults);
  const similarLoading = useStore((s) => s.similarLoading);
  const setSimilarResults = useStore((s) => s.setSimilarResults);
  const cardDensity = useStore((s) => s.cardDensity);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const selectAllCompanies = useStore((s) => s.selectAllCompanies);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Pick 6 random example queries per mount
  const exampleQueries = useMemo(() => {
    const shuffled = [...ALL_EXAMPLE_QUERIES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only on mount
  }, []);

  const [showOnboarding, setShowOnboarding] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("nav_onboarded")
  );
  const [relatedCollapsed, setRelatedCollapsed] = useState(true);
  const [lowFitCollapsed, setLowFitCollapsed] = useState(true);
  const [previousResultCount, setPreviousResultCount] = useState(6);

  const companies = filteredCompanies();

  // Count how many search results are hidden by not_relevant feedback
  const hiddenCount = useMemo(() => {
    if (!searchResults) return 0;
    return searchResults.filter((c) => relevanceFeedback?.[c.domain]?.feedback === "not_relevant").length;
  }, [searchResults, relevanceFeedback]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    // Defer setState to avoid synchronous setState-in-effect lint error
    requestAnimationFrame(() => {
      setRelatedCollapsed(true);
      if (searchResults && searchResults.length > 0) {
        setPreviousResultCount(Math.min(searchResults.length, 10));
      }
    });
  }, [searchResults]);

  // Seed contacts into store when demo mode is active
  const hasSearched = searchResults !== null;
  const seedContactsLoadedRef = useRef(false);
  useEffect(() => {
    if (demoMode && !hasSearched && !seedContactsLoadedRef.current) {
      for (const [domain, contacts] of Object.entries(SEED_CONTACTS)) {
        setContactsForDomain(domain, contacts);
      }
      seedContactsLoadedRef.current = true;
    }
  }, [demoMode, hasSearched, setContactsForDomain]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("nav_onboarded", "1");
  };

  const showDemoData = demoMode && !hasSearched && !searchLoading;

  const handleSortChange = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }, [sortField, sortDirection, setSortField, setSortDirection]);

  const handleSortDirectionToggle = useCallback(() => {
    setSortDirection(sortDirection === "desc" ? "asc" : "desc");
  }, [sortDirection, setSortDirection]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode !== "companies") setAllContactsViewActive(false);
  }, [setViewMode, setAllContactsViewActive]);

  const handleDeselectAll = useCallback(() => {
    deselectAllCompanies();
  }, [deselectAllCompanies]);

  const handleAllContactsToggle = useCallback(() => {
    if (allContactsViewActive) {
      setAllContactsViewActive(false);
    } else {
      setViewMode("companies");
      setAllContactsViewActive(true);
    }
  }, [allContactsViewActive, setAllContactsViewActive, setViewMode]);

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
      <ResultsTabBar
        viewMode={viewMode}
        sortField={sortField}
        sortDirection={sortDirection}
        companyCount={companies.length}
        prospectCount={prospectList.size}
        selectedCompanyCount={selectedCompanyDomains.size}
        searchLoading={searchLoading}
        onViewModeChange={handleViewModeChange}
        onSortChange={handleSortChange}
        onSortDirectionToggle={handleSortDirectionToggle}
        onDeselectAll={handleDeselectAll}
        allContactsActive={allContactsViewActive}
        onAllContactsToggle={handleAllContactsToggle}
      />

      {/* Search query header + filter pills + error banner */}
      <ResultsHeader
        hasSearched={hasSearched}
        searchLoading={searchLoading}
        lastSearchQuery={lastSearchQuery}
        companyCount={companies.length}
        lastExcludedCount={lastExcludedCount}
        searchError={searchError}
      />

      {/* Quick filter bar */}
      {hasSearched && !searchLoading && <QuickFilterBar />}

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
              <SkeletonCard key={i} density={cardDensity} />
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
          showDemoData ? (
            /* ======== Demo data mode ======== */
            <div className="space-y-3">
              {/* Demo badge */}
              <div className="animate-fadeInUp flex items-center justify-center gap-2 rounded-card border border-surface-3 bg-surface-1/60 px-4 py-2.5">
                <span className="rounded-pill border border-accent-secondary/30 bg-accent-secondary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-secondary">
                  Demo data
                </span>
                <span className="text-xs text-text-tertiary">
                  Showing sample companies — run a search to see real results
                </span>
              </div>

              {/* Quick start chips */}
              <div className="flex flex-wrap justify-center gap-2 pb-1">
                {quickStartChips.slice(0, 4).map((chip, i) => (
                  <button
                    key={`${chip.label}-${i}`}
                    onClick={chip.onClick}
                    className="btn-press animate-fadeInUp rounded-pill border border-surface-3 bg-surface-1 px-4 py-2 text-xs font-medium text-text-secondary shadow-sm transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-md hover:text-text-primary max-w-[220px] truncate"
                    style={{ animationDelay: `${60 + i * 40}ms` }}
                    title={chip.label}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Seed company cards */}
              <div role="listbox" aria-label="Demo company results" className="space-y-1.5">
                {SEED_COMPANIES.map((company, idx) => (
                  <div
                    key={company.domain}
                    className="animate-fadeInUp"
                    style={{ animationDelay: `${100 + idx * 50}ms` }}
                  >
                    <CompanyCard
                      company={company}
                      isSelected={selectedCompanyDomain === company.domain}
                      isChecked={selectedCompanyDomains.has(company.domain)}
                      onSelect={() => selectCompany(company.domain)}
                      onToggleCheck={() => toggleCompanySelection(company.domain)}
                      compact={cardDensity === "compact"}
                    />
                    {expandedContactsDomain === company.domain && (
                      <InlineContacts domain={company.domain} companyName={company.name} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ======== Standard welcome state (demo off) ======== */
            <div className="flex h-full flex-col items-center justify-center">
              {showOnboarding && (
                <OnboardingTour onDismiss={dismissOnboarding} />
              )}
              <SessionStarterCard />
              <h2 className="animate-fadeInUp font-display text-2xl text-text-primary" style={{ animationDelay: "0ms" }}>
                Search for companies
              </h2>
              <p className="animate-fadeInUp mt-2 text-sm text-text-secondary" style={{ animationDelay: "60ms" }}>
                A specific company, an industry, or a description of your ideal prospect
              </p>

              {prospectList.size > 0 && (
                <button
                  onClick={() => setViewMode("prospect_list")}
                  className="animate-fadeInUp mt-4 rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors duration-[180ms]"
                  style={{ animationDelay: "90ms" }}
                >
                  Resume ({prospectList.size} prospect{prospectList.size === 1 ? "" : "s"})
                </button>
              )}

              {history.length > 0 ? (
                <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                  {quickStartChips.map((chip, i) => (
                    <button
                      key={`${chip.label}-${i}`}
                      onClick={chip.onClick}
                      className="btn-press animate-fadeInUp rounded-pill border border-surface-3 bg-surface-1 px-5 py-2.5 text-sm font-medium text-text-secondary shadow-sm transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-md hover:text-text-primary max-w-[220px] truncate"
                      style={{ animationDelay: `${120 + i * 60}ms` }}
                      title={chip.label}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 w-full max-w-lg space-y-4">
                  {EXAMPLE_CATEGORIES.map((cat, ci) => (
                    <div key={cat.label} className="animate-fadeInUp" style={{ animationDelay: `${120 + ci * 80}ms` }}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        {cat.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {cat.examples.map((q) => (
                          <button
                            key={q}
                            onClick={() => setPendingFreeTextSearch(q)}
                            className="btn-press rounded-pill border border-surface-3 bg-surface-1 px-4 py-2 text-sm font-medium text-text-secondary shadow-sm transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-md hover:text-text-primary max-w-[260px] truncate"
                            title={q}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Team presets */}
              {presets.length > 0 && (
                <div className="mt-6 w-full max-w-lg animate-fadeInUp" style={{ animationDelay: "400ms" }}>
                  <div className="mb-2 flex items-center justify-center gap-1.5">
                    <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Team Presets</p>
                    {presets.some((p) => (p.newResultCount ?? 0) > 0) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-primary animate-pulse" />
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {presets.slice(0, 6).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          loadPreset(preset.id);
                        }}
                        className="relative rounded-pill border border-accent-primary/20 bg-accent-primary/5 px-3 py-1.5 text-xs text-accent-primary transition-colors hover:bg-accent-primary/10 hover:border-accent-primary/40"
                      >
                        {preset.name}
                        {(preset.newResultCount ?? 0) > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-primary px-1 font-mono text-[9px] font-bold text-surface-0">
                            {preset.newResultCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )
        ) : allContactsViewActive && viewMode === "companies" ? (
          <AllContactsView />
        ) : viewMode === "companies" && cardDensity === "table" ? (
          companies.length === 0 ? (
            searchError ? (
              <EmptyState icon="search" title="Search failed" description="Something went wrong with the search. Check the error above and try again." />
            ) : (
              <NoResultsSuggestions />
            )
          ) : (
            <>
              <SimilarSearchBanner />
              <CompanyTable
                companies={companies}
                selectedCompanyDomain={selectedCompanyDomain}
                selectedCompanyDomains={selectedCompanyDomains}
                contactsByDomain={contactsByDomain}
                onSelectCompany={selectCompany}
                onToggleCheck={toggleCompanySelection}
                onSelectAll={selectAllCompanies}
                onDeselectAll={deselectAllCompanies}
              />
            </>
          )
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
            <>
            <SimilarSearchBanner />
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
                // Build a domain→searchResults index map for data-result-index
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
                        compact={cardDensity === "compact"}
                      />
                      {expandedContactsDomain === company.domain && (
                        <InlineContacts domain={company.domain} companyName={company.name} />
                      )}
                    </div>
                  );
                };

                // Flat list — exact match pinned at top when present
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
                        compact={cardDensity === "compact"}
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
                  <IcpTierGroupedList
                    companies={companies}
                    renderCompanyItem={renderCompanyItem}
                    lowFitCollapsed={lowFitCollapsed}
                    setLowFitCollapsed={setLowFitCollapsed}
                  />
                );
              })()}
            </div>
            {hiddenCount > 0 && (
              <div className="mt-2 flex justify-center">
                <button
                  onClick={() => setShowHiddenResults(!showHiddenResults)}
                  className="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1 transition-colors duration-[180ms]"
                >
                  {showHiddenResults
                    ? "Hide not-relevant results"
                    : `Show ${hiddenCount} hidden result${hiddenCount === 1 ? "" : "s"}`}
                </button>
              </div>
            )}
            {(similarResults || similarLoading) && (
              <div className="border-t border-accent-secondary/30 mt-4 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-secondary">
                    Similar to {similarResults?.seedName ?? "..."}
                  </span>
                  <button
                    onClick={() => setSimilarResults(null)}
                    className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
                {similarLoading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonCard key={`similar-skel-${i}`} />
                    ))}
                  </div>
                ) : similarResults && similarResults.companies.length > 0 ? (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {similarResults.companies.map((company, idx) => (
                      <div
                        key={company.domain}
                        className="animate-fadeInUp"
                        style={{ animationDelay: `${Math.min(idx, 10) * 40}ms` }}
                      >
                        <CompanyCard
                          company={company}
                          isSelected={selectedCompanyDomain === company.domain}
                          isChecked={selectedCompanyDomains.has(company.domain)}
                          onSelect={() => selectCompany(company.domain)}
                          onToggleCheck={() => toggleCompanySelection(company.domain)}
                          compact={cardDensity === "compact"}
                        />
                        {expandedContactsDomain === company.domain && (
                          <InlineContacts domain={company.domain} companyName={company.name} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : similarResults ? (
                  <p className="text-xs text-text-tertiary italic py-2">
                    No similar companies found
                  </p>
                ) : null}
              </div>
            )}
            </>
          )
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ICP Tier Grouped List (G1) — groups companies by ICP tier
// ─────────────────────────────────────────────────────────
function IcpTierGroupedList({
  companies,
  renderCompanyItem,
  lowFitCollapsed,
  setLowFitCollapsed,
}: {
  companies: CompanyEnriched[];
  renderCompanyItem: (company: CompanyEnriched, idx: number) => React.ReactNode;
  lowFitCollapsed: boolean;
  setLowFitCollapsed: (v: boolean) => void;
}) {
  const highFit = companies.filter((c) => c.icpScore >= 70);
  const goodFit = companies.filter((c) => c.icpScore >= 40 && c.icpScore < 70);
  const lowFit = companies.filter((c) => c.icpScore < 40);

  // If all companies are in the same tier, skip section headers
  const tierCount = [highFit.length, goodFit.length, lowFit.length].filter((n) => n > 0).length;
  if (tierCount <= 1 && lowFit.length === 0) {
    return <>{companies.map((company, index) => renderCompanyItem(company, index))}</>;
  }

  let runningIdx = 0;

  return (
    <>
      {highFit.length > 0 && (
        <div>
          <div className="mb-1.5 px-1 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-primary">
              High Fit
            </span>
            <span className="text-[10px] tabular-nums text-text-tertiary">{highFit.length}</span>
          </div>
          <div className="space-y-1.5">
            {highFit.map((company) => {
              const node = renderCompanyItem(company, runningIdx);
              runningIdx++;
              return node;
            })}
          </div>
        </div>
      )}

      {goodFit.length > 0 && (
        <div className={highFit.length > 0 ? "mt-4" : ""}>
          <div className="mb-1.5 px-1 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Good Fit
            </span>
            <span className="text-[10px] tabular-nums text-text-tertiary">{goodFit.length}</span>
          </div>
          <div className="space-y-1.5">
            {goodFit.map((company) => {
              const node = renderCompanyItem(company, runningIdx);
              runningIdx++;
              return node;
            })}
          </div>
        </div>
      )}

      {lowFit.length > 0 && (
        <div className={(highFit.length > 0 || goodFit.length > 0) ? "mt-4" : ""}>
          <button
            onClick={() => setLowFitCollapsed(!lowFitCollapsed)}
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
              className={`flex-shrink-0 transition-transform duration-[180ms] ${lowFitCollapsed ? "-rotate-90" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              {lowFitCollapsed
                ? `Show ${lowFit.length} low-fit result${lowFit.length === 1 ? "" : "s"}`
                : `Low Fit`}
            </span>
            {!lowFitCollapsed && (
              <span className="text-[10px] tabular-nums text-text-tertiary">{lowFit.length}</span>
            )}
          </button>
          {!lowFitCollapsed && (
            <div className="mt-1 space-y-1.5">
              {lowFit.map((company) => {
                const node = renderCompanyItem(company, runningIdx);
                runningIdx++;
                return node;
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Onboarding Tour (I3) — 3-step walkthrough
// ─────────────────────────────────────────────────────────
function OnboardingTour({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Search", body: "Type a company name, industry, or description in the search bar above. Or press \u2318K for a powerful free-text search." },
    { title: "Filter", body: "Use the filter pills above the results to narrow by vertical, region, company size, and buying signals. Or press \u2318K to refine your search." },
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
    <p aria-live="polite" className="mb-2 text-xs text-text-tertiary transition-opacity duration-200">
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
  const cardDensity = useStore((s) => s.cardDensity);

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
        description={pick("empty_prospects")}
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
              compact={cardDensity === "compact"}
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
// No Results Suggestions (A2) — actionable filter removal + search tips
// ─────────────────────────────────────────────────────────
function NoResultsSuggestions() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);
  const searchWarnings = useStore((s) => s.searchWarnings);

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

  const searchTips: { tip: string; example: string }[] = [
    { tip: "Try a broader search", example: "chemicals in Europe" },
    { tip: "Search by company name", example: "BASF SE" },
    { tip: "Use industry keywords", example: "food ingredients manufacturers" },
  ];

  return (
    <EmptyState
      icon="search"
      title="No matches found"
      description={lastSearchQuery ? `No results for "${lastSearchQuery}"` : pick("empty_results")}
    >
      {/* API warnings (e.g. simplified query info) */}
      {searchWarnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {searchWarnings.map((w, i) => (
            <p key={i} className="text-xs text-accent-secondary">{w}</p>
          ))}
          {searchWarnings.some((w) => /simplif|rephras/i.test(w)) && (
            <p className="mt-1 text-xs italic text-text-tertiary">
              The query was automatically simplified — try a more specific search
            </p>
          )}
        </div>
      )}

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

      {/* Search tips with clickable examples */}
      <div className="mt-4 w-full max-w-sm space-y-2">
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Search tips</p>
        {searchTips.map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-card border border-surface-3 bg-surface-1 px-3 py-2">
            <span className="text-xs text-text-tertiary">{t.tip}</span>
            <button
              onClick={() => setPendingFreeTextSearch(t.example)}
              className="rounded-pill border border-accent-primary/20 bg-accent-primary/5 px-2.5 py-1 font-mono text-[11px] text-accent-primary transition-colors hover:bg-accent-primary/10 hover:border-accent-primary/40"
            >
              {t.example}
            </button>
          </div>
        ))}
      </div>
    </EmptyState>
  );
}
