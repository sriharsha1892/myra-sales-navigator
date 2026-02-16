"use client";

import { useStore } from "@/lib/navigator/store";
import { CompanyCard } from "@/components/navigator/cards/CompanyCard";
import { InlineContacts } from "@/components/navigator/cards/InlineContacts";
import { SkeletonCard } from "@/components/navigator/cards/SkeletonCard";
import { EmptyState } from "@/components/navigator/shared";
import type { SortField, CompanyEnriched } from "@/lib/navigator/types";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { pick } from "@/lib/navigator/ui-copy";
import { SimilarSearchBanner } from "@/components/navigator/banners/SimilarSearchBanner";
import { ResultsTabBar } from "./ResultsTabBar";
import { ResultsHeader } from "./ResultsHeader";
import { CompanyTable } from "@/components/navigator/table/CompanyTable";
import { QuickFilterBar } from "@/components/navigator/shared/QuickFilterBar";
import { MorningDashboard } from "@/components/navigator/home/MorningDashboard";

export function ResultsList() {
  const sortField = useStore((s) => s.sortField);
  const sortDirection = useStore((s) => s.sortDirection);
  const setSortField = useStore((s) => s.setSortField);
  const setSortDirection = useStore((s) => s.setSortDirection);
  const searchError = useStore((s) => s.searchError);
  const searchResults = useStore((s) => s.searchResults);
  const searchLoading = useStore((s) => s.searchLoading);
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);

  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const toggleCompanySelection = useStore((s) => s.toggleCompanySelection);
  const expandedContactsDomain = useStore((s) => s.expandedContactsDomain);
  const lastExcludedCount = useStore((s) => s.lastExcludedCount);
  const deselectAllCompanies = useStore((s) => s.deselectAllCompanies);
  const activeResultIndex = useStore((s) => s.activeResultIndex);
  const relevanceFeedback = useStore((s) => s.relevanceFeedback);
  const showHiddenResults = useStore((s) => s.showHiddenResults);
  const setShowHiddenResults = useStore((s) => s.setShowHiddenResults);
  const similarResults = useStore((s) => s.similarResults);
  const similarLoading = useStore((s) => s.similarLoading);
  const setSimilarResults = useStore((s) => s.setSimilarResults);
  const cardDensity = useStore((s) => s.cardDensity);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const selectAllCompanies = useStore((s) => s.selectAllCompanies);
  const searchPhase = useStore((s) => s.searchPhase);

  const scrollRef = useRef<HTMLDivElement>(null);

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

  const hasSearched = searchResults !== null;

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

  const handleDeselectAll = useCallback(() => {
    deselectAllCompanies();
  }, [deselectAllCompanies]);

  return (
    <div className="flex h-full flex-col bg-surface-0">
      {/* Top bar */}
      <ResultsTabBar
        sortField={sortField}
        sortDirection={sortDirection}
        selectedCompanyCount={selectedCompanyDomains.size}
        searchLoading={searchLoading}
        onSortChange={handleSortChange}
        onSortDirectionToggle={handleSortDirectionToggle}
        onDeselectAll={handleDeselectAll}
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

      {/* Enrichment phase indicator */}
      {searchPhase === "enriching" && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <svg className="h-3 w-3 animate-spin text-accent-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <span className="text-xs text-accent-secondary">Enriching with Apollo...</span>
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
              <button
                onClick={() => useStore.getState().cancelSearch?.()}
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
            <ContextualLoadingMessage />
            {Array.from({ length: previousResultCount }).map((_, i) => (
              <SkeletonCard key={i} density={cardDensity} />
            ))}
          </div>
        ) : !hasSearched ? (
          <MorningDashboard />
        ) : cardDensity === "table" ? (
          companies.length === 0 ? (
            searchError ? (
              <EmptyState icon="search" title="Search failed" description="Something went wrong with the search. Check the error above and try again." />
            ) : (
              <NoResultsSuggestions />
            )
          ) : (
            <>
              <DidYouMeanBanner />
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
        ) : companies.length === 0 ? (
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
            <DidYouMeanBanner />
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
                // Build a domain→visible index map for data-result-index (matches arrow key navigation)
                const domainToVisibleIndex = new Map<string, number>();
                companies.forEach((c, i) => domainToVisibleIndex.set(c.domain, i));

                // Helper: renders a CompanyCard + inline contacts accordion
                const renderCompanyItem = (company: CompanyEnriched, idx: number) => {
                  const resultIdx = domainToVisibleIndex.get(company.domain);
                  const isActiveResult = activeResultIndex != null && resultIdx === activeResultIndex;
                  return (
                    <div
                      key={company.domain}
                      data-result-index={resultIdx}
                      className={`animate-fadeInUp${isActiveResult ? " ring-1 ring-accent-secondary/40 bg-surface-hover/50 rounded-card" : ""}`}
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
          )}
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
// No Results Suggestions (A2) — actionable filter removal + search tips
// ─────────────────────────────────────────────────────────
function NoResultsSuggestions() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);
  const searchWarnings = useStore((s) => s.searchWarnings);
  const searchMeta = useStore((s) => s.searchMeta);

  const didYouMean = searchMeta?.didYouMean;

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
      {/* Did You Mean suggestion */}
      {didYouMean && (
        <div className="mt-3 rounded-card border border-accent-secondary/30 bg-accent-secondary/5 px-4 py-3">
          <p className="text-sm text-text-secondary">
            Did you mean{" "}
            <button
              onClick={() => setPendingFreeTextSearch(didYouMean.simplified)}
              className="font-medium text-accent-secondary hover:underline"
            >
              &ldquo;{didYouMean.simplified}&rdquo;
            </button>
            ?
          </p>
        </div>
      )}

      {/* API warnings (e.g. simplified query info) */}
      {searchWarnings.length > 0 && !didYouMean && (
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

// ─────────────────────────────────────────────────────────
// Did You Mean Banner (shown above results when query was auto-simplified)
// ─────────────────────────────────────────────────────────
function DidYouMeanBanner() {
  const searchMeta = useStore((s) => s.searchMeta);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const [dismissed, setDismissed] = useState(false);

  const didYouMean = searchMeta?.didYouMean;
  if (!didYouMean || dismissed) return null;

  return (
    <div className="mb-2 flex items-center justify-between rounded-card border border-accent-secondary/30 bg-accent-secondary/5 px-3 py-2">
      <p className="text-xs text-text-secondary">
        Showing results for <span className="font-medium text-accent-secondary">&ldquo;{didYouMean.simplified}&rdquo;</span>.{" "}
        <button
          onClick={() => setPendingFreeTextSearch(didYouMean.original)}
          className="text-accent-secondary hover:underline"
        >
          Search instead for &ldquo;{didYouMean.original}&rdquo;
        </button>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 text-text-tertiary hover:text-text-secondary"
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
