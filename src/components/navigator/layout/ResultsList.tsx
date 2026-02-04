"use client";

import { useStore } from "@/lib/navigator/store";
import { CompanyCard } from "@/components/navigator/cards/CompanyCard";
import { ContactCard } from "@/components/navigator/cards/ContactCard";
import { SkeletonCard } from "@/components/navigator/cards/SkeletonCard";
import { ViewToggle, QuickFilterChips, ResultFilterChips, EmptyState } from "@/components/navigator/shared";
import { ContactFilters } from "@/components/navigator/shared/ContactFilters";
import type { SortField, CompanyEnriched, ResultSource } from "@/lib/navigator/types";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { useContactsTab } from "@/hooks/navigator/useContactsTab";
import { timeAgo } from "@/lib/utils";
import { MyProspects } from "./MyProspects";
import { pick } from "@/lib/navigator/ui-copy";
import { IcpScoreBadge } from "@/components/navigator/badges";

interface TrendingCompany {
  domain: string;
  name: string;
  viewerCount: number;
  viewerNames: string[];
  lastViewed: string;
}

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
  const { history } = useSearchHistory();

  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);
  const toggleCompanySelection = useStore((s) => s.toggleCompanySelection);
  const sessionCompaniesReviewed = useStore((s) => s.sessionCompaniesReviewed);
  const sessionContactsExported = useStore((s) => s.sessionContactsExported);
  const contactGroupsCollapsed = useStore((s) => s.contactGroupsCollapsed);
  const toggleContactGroupCollapsed = useStore((s) => s.toggleContactGroupCollapsed);
  const contactVisibleFields = useStore((s) => s.contactVisibleFields);
  const focusedContactId = useStore((s) => s.focusedContactId);
  const setFocusedContactId = useStore((s) => s.setFocusedContactId);

  // Contacts tab hook — only fetches when viewMode === "contacts"
  const {
    isLoading: contactsLoading,
    fetchedCount,
    totalCount,
    estimatedTotal,
    groupedContacts,
    personaGroups,
    failedDomains,
    retryDomain,
  } = useContactsTab();

  const scrollRef = useRef<HTMLDivElement>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [whatsNew, setWhatsNew] = useState<Record<string, number>>({});
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [relatedCollapsed, setRelatedCollapsed] = useState(true);

  // Build a lookup map for companies by domain
  const companies = filteredCompanies();
  const companyByDomain = useMemo(() => {
    const map = new Map<string, CompanyEnriched>();
    for (const c of companies) map.set(c.domain, c);
    // Also check searchResults for companies not in filtered
    if (searchResults) for (const c of searchResults) { if (!map.has(c.domain)) map.set(c.domain, c); }
    return map;
  }, [companies, searchResults]);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("nav_onboarded")) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("nav_first_search_done") && !searchResults) {
      setShowDemo(true);
    }
  }, [searchResults]);

  useEffect(() => {
    if (searchResults) {
      setShowDemo(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("nav_first_search_done", "1");
      }
    }
  }, [searchResults]);

  useEffect(() => {
    fetch("/api/session/whats-new")
      .then((r) => r.json())
      .then((data) => setWhatsNew(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/session/trending")
      .then((r) => r.json())
      .then((data) => setTrending(data.trending ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setRelatedCollapsed(true); // Reset collapsed state on new search
  }, [searchResults]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("nav_onboarded", "1");
  };

  const dismissDemo = () => {
    setShowDemo(false);
    localStorage.setItem("nav_first_search_done", "1");
  };

  // Contact count display
  const totalContactsDisplayed = useMemo(
    () => groupedContacts.reduce((sum, g) => sum + g.contacts.length, 0),
    [groupedContacts]
  );

  const contactCountLabel = contactsLoading
    ? `~${estimatedTotal} contacts (loading...)`
    : `${totalContactsDisplayed} contacts`;

  const count = viewMode === "companies" ? companies.length : totalContactsDisplayed;
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

  const whatsNewEntries = Object.entries(whatsNew).filter(([, v]) => v > 0);

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
          onChange={setViewMode}
          companyCount={companies.length}
          contactCount={totalContactsDisplayed}
          selectedCompanyContactCount={
            selectedCompanyDomain
              ? (groupedContacts.find((g) => g.domain === selectedCompanyDomain)?.contacts.length ??
                companyByDomain.get(selectedCompanyDomain)?.contactCount)
              : undefined
          }
          selectedCompanyName={
            selectedCompanyDomain
              ? (companyByDomain.get(selectedCompanyDomain)?.name ?? selectedCompanyDomain)
              : undefined
          }
        />
        {viewMode === "companies" && companies.length > 0 && (() => {
          const avg = Math.round(companies.reduce((s, c) => s + c.icpScore, 0) / companies.length);
          const color = avg >= 70 ? "text-success" : avg >= 50 ? "text-warning" : "text-text-tertiary";
          return (
            <span className={`rounded-pill border border-surface-3 px-2 py-0.5 font-mono text-[10px] ${color}`}>
              Avg match: {avg}
            </span>
          );
        })()}
        {/* Contacts loading progress */}
        {viewMode === "contacts" && contactsLoading && totalCount > 0 && (
          <span className="rounded-pill border border-accent-primary/30 bg-accent-primary/5 px-2 py-0.5 font-mono text-[10px] text-accent-primary">
            {fetchedCount}/{totalCount} companies
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {viewMode === "companies" && (
            <>
              {/* Sort — dot-separated text links */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase tracking-[0.06em] text-text-secondary">Sort</span>
                <div className="flex items-center">
                  {(["icp_score", "name", "employee_count"] as SortField[]).map((field, i) => {
                    const labels: Record<SortField, string> = { icp_score: "Score", name: "Name", employee_count: "Size", relevance: "Relevance" };
                    const isActive = sortField === field;
                    return (
                      <span key={field} className="flex items-center">
                        {i > 0 && <span className="mx-1 text-text-tertiary/40">·</span>}
                        <button
                          onClick={() => handleSortChange(field)}
                          className={`text-xs transition-colors duration-[180ms] ${
                            isActive
                              ? "font-semibold text-text-primary"
                              : "text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {labels[field]}
                        </button>
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
                  className="btn-press text-xs text-text-tertiary hover:text-text-primary transition-colors duration-[180ms]"
                  title={sortDirection === "desc" ? "Descending" : "Ascending"}
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
                          className={`text-xs transition-colors duration-[180ms] ${
                            isActive
                              ? "font-semibold text-text-primary"
                              : "text-text-secondary hover:text-text-primary"
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
        </div>
      </div>

      {/* Preset pills */}
      {hasSearched && !searchLoading && <PresetPills />}

      {/* Contact-specific filters */}
      {viewMode === "contacts" && hasSearched && !searchLoading && (
        <ContactFilters />
      )}

      {/* Filter chips — single merged row, only shown after first search */}
      {viewMode === "companies" && hasSearched && !searchLoading && (
        <div className="bg-surface-0 flex flex-shrink-0 flex-wrap gap-1.5 border-b border-surface-3 px-4 py-2">
          <QuickFilterChips />
          <ResultFilterChips />
        </div>
      )}

      {/* Error banner */}
      {searchError && (
        <div className="flex-shrink-0 border-b border-danger/20 bg-danger-light px-4 py-2">
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
            <p className="mb-2 text-xs text-text-tertiary">{pick("search_loading")}</p>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !hasSearched ? (
          /* Welcome state — before first search */
          <div className="flex h-full flex-col items-center justify-center">
            {showOnboarding && (
              <div className="mb-6 w-full max-w-lg animate-fadeInUp rounded-card border border-surface-3 bg-surface-1 px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-text-secondary">
                    Welcome to Sales Navigator — search for any company, industry, or description.
                    Try clicking an example below, or press <kbd className="rounded border border-surface-3 bg-surface-2 px-1 py-0.5 font-mono text-[10px]">&#8984;K</kbd> for a powerful free-text search.
                  </p>
                  <button
                    onClick={dismissOnboarding}
                    className="flex-shrink-0 rounded-input border border-surface-3 px-2.5 py-1 text-xs text-text-secondary hover:bg-surface-2"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
            <h2 className="animate-fadeInUp font-display text-2xl text-text-primary" style={{ animationDelay: "0ms" }}>
              Search for companies
            </h2>
            <p className="animate-fadeInUp mt-2 text-sm text-text-secondary" style={{ animationDelay: "60ms" }}>
              A specific company, an industry, or a description of your ideal prospect
            </p>

            {history.length > 0 && history[0].label && (
              <button
                onClick={() => setPendingFreeTextSearch(history[0].label ?? "")}
                className="animate-fadeInUp mt-3 text-xs text-accent-secondary hover:underline"
                style={{ animationDelay: "80ms" }}
              >
                Resume: {history[0].label} ({history[0].resultCount} results)
              </button>
            )}

            {whatsNewEntries.length > 0 && (
              <p className="animate-fadeInUp mt-2 text-xs text-text-tertiary" style={{ animationDelay: "90ms" }}>
                This week: {whatsNewEntries.map(([type, count]) => `${count} ${type}`).join(" · ")}
              </p>
            )}

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
            {trending.length > 0 && (
              <div className="mt-5 w-full max-w-md animate-fadeInUp" style={{ animationDelay: "100ms" }}>
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Trending</p>
                <div className="space-y-1">
                  {trending.map((t) => (
                    <button
                      key={t.domain}
                      onClick={() => selectCompany(t.domain)}
                      className="flex w-full items-center gap-2 rounded-card border border-surface-3 bg-surface-1 px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span className="text-xs font-medium text-text-primary">{t.name}</span>
                      <span className="ml-auto text-[10px] text-text-tertiary">
                        viewed by {t.viewerNames.join(" + ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex w-full justify-center">
              <MyProspects />
            </div>

            {showDemo && (
              <DemoResults onDismiss={dismissDemo} />
            )}
          </div>
        ) : viewMode === "companies" ? (
          companies.length === 0 ? (() => {
            const filters = useStore.getState().filters;
            const hasActiveFilters = filters.verticals.length > 0 || filters.regions.length < 5 || filters.sizes.length < 4 || filters.signals.length < 4;
            const suggestion = hasActiveFilters
              ? "Try loosening a filter or broadening your search."
              : undefined;
            return (
              <EmptyState
                title="No matches found"
                description={suggestion ? pick("empty_results_suggestion") : pick("empty_results")}
              />
            );
          })() : (
            <div
              role="listbox"
              aria-label="Company results"
              aria-activedescendant={
                selectedCompanyDomain ? `company-${selectedCompanyDomain}` : undefined
              }
              tabIndex={0}
              className="space-y-1.5 focus:outline-none"
            >
              {resultGrouping === "icp_tier" ? (() => {
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
                        {tierCompanies.map((company) => {
                          const idx = globalIdx++;
                          return (
                            <div
                              key={company.domain}
                              className="animate-fadeInUp"
                              style={{ animationDelay: `${idx * 40}ms` }}
                            >
                              <CompanyCard
                                company={company}
                                isSelected={selectedCompanyDomain === company.domain}
                                isChecked={selectedCompanyDomains.has(company.domain)}
                                onSelect={() => selectCompany(company.domain)}
                                onToggleCheck={() => toggleCompanySelection(company.domain)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })() : resultGrouping === "source" ? (() => {
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
                          {exaCompanies.map((company) => {
                            const idx = globalIdx++;
                            return (
                              <div key={company.domain} className="animate-fadeInUp" style={{ animationDelay: `${idx * 40}ms` }}>
                                <CompanyCard
                                  company={company}
                                  isSelected={selectedCompanyDomain === company.domain}
                                  isChecked={selectedCompanyDomains.has(company.domain)}
                                  onSelect={() => selectCompany(company.domain)}
                                  onToggleCheck={() => toggleCompanySelection(company.domain)}
                                />
                              </div>
                            );
                          })}
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
                          {apolloOnly.map((company) => {
                            const idx = globalIdx++;
                            return (
                              <div key={company.domain} className="animate-fadeInUp" style={{ animationDelay: `${idx * 40}ms` }}>
                                <CompanyCard
                                  company={company}
                                  isSelected={selectedCompanyDomain === company.domain}
                                  isChecked={selectedCompanyDomains.has(company.domain)}
                                  onSelect={() => selectCompany(company.domain)}
                                  onToggleCheck={() => toggleCompanySelection(company.domain)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })() : (() => {
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
                          Related companies
                        </span>
                        <span className="font-mono text-[10px] text-text-tertiary">({related.length})</span>
                      </button>
                      {!relatedCollapsed && (
                        <div className="mt-1 space-y-1.5">
                          {related.map((company, index) => (
                            <div
                              key={company.domain}
                              className="animate-fadeInUp"
                              style={{ animationDelay: `${index * 40}ms` }}
                            >
                              <CompanyCard
                                company={company}
                                isSelected={selectedCompanyDomain === company.domain}
                                isChecked={selectedCompanyDomains.has(company.domain)}
                                onSelect={() => selectCompany(company.domain)}
                                onToggleCheck={() => toggleCompanySelection(company.domain)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  companies.map((company, index) => (
                    <div
                      key={company.domain}
                      className="animate-fadeInUp"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <CompanyCard
                        company={company}
                        isSelected={selectedCompanyDomain === company.domain}
                        isChecked={selectedCompanyDomains.has(company.domain)}
                        onSelect={() => selectCompany(company.domain)}
                        onToggleCheck={() => toggleCompanySelection(company.domain)}
                      />
                    </div>
                  ))
                );
              })()}
            </div>
          )
        ) : (
          /* ======== Contacts view ======== */
          <ContactsErrorBoundary>
            <ContactsView
              contactsLoading={contactsLoading}
              groupedContacts={groupedContacts}
              personaGroups={personaGroups}
              fetchedCount={fetchedCount}
              totalCount={totalCount}
              estimatedTotal={estimatedTotal}
              totalContactsDisplayed={totalContactsDisplayed}
              companyByDomain={companyByDomain}
              selectedContactIds={selectedContactIds}
              toggleContactSelection={toggleContactSelection}
              contactGroupsCollapsed={contactGroupsCollapsed}
              toggleContactGroupCollapsed={toggleContactGroupCollapsed}
              contactVisibleFields={contactVisibleFields}
              expandedContactId={expandedContactId}
              setExpandedContactId={setExpandedContactId}
              focusedContactId={focusedContactId}
              failedDomains={failedDomains}
              retryDomain={retryDomain}
            />
          </ContactsErrorBoundary>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Preset Pills — top 3 presets as quick-access pills
// ─────────────────────────────────────────────────────────
function PresetPills() {
  const presets = useStore((s) => s.presets);
  const loadPreset = useStore((s) => s.loadPreset);
  const [showAll, setShowAll] = useState(false);

  if (!presets || presets.length === 0) return null;

  const visible = showAll ? presets : presets.slice(0, 3);

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-b border-surface-3 bg-surface-0 px-4 py-1.5">
      <span className="text-[10px] text-text-tertiary">Presets</span>
      {visible.map((p) => (
        <button
          key={p.id}
          onClick={() => loadPreset(p.id)}
          className="rounded-pill border border-surface-3 bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-all duration-[180ms] hover:border-accent-primary/40 hover:text-text-primary"
        >
          {p.name}
        </button>
      ))}
      {presets.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-[10px] text-text-tertiary hover:text-accent-primary"
        >
          +{presets.length - 3} more
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Contacts View — grouped by company with sticky headers
// ─────────────────────────────────────────────────────────
function ContactsView({
  contactsLoading,
  groupedContacts,
  personaGroups,
  fetchedCount,
  totalCount,
  estimatedTotal,
  totalContactsDisplayed,
  companyByDomain,
  selectedContactIds,
  toggleContactSelection,
  contactGroupsCollapsed,
  toggleContactGroupCollapsed,
  contactVisibleFields,
  expandedContactId,
  setExpandedContactId,
  focusedContactId,
  failedDomains,
  retryDomain,
}: {
  contactsLoading: boolean;
  groupedContacts: { domain: string; companyName: string; icpScore: number; contacts: import("@/lib/navigator/types").Contact[] }[];
  personaGroups: import("@/hooks/navigator/useContactsTab").PersonaGroup[];
  fetchedCount: number;
  totalCount: number;
  estimatedTotal: number;
  totalContactsDisplayed: number;
  companyByDomain: Map<string, CompanyEnriched>;
  selectedContactIds: Set<string>;
  toggleContactSelection: (id: string) => void;
  contactGroupsCollapsed: Record<string, boolean>;
  toggleContactGroupCollapsed: (domain: string) => void;
  contactVisibleFields: Set<string>;
  expandedContactId: string | null;
  setExpandedContactId: (id: string | null) => void;
  focusedContactId: string | null;
  failedDomains: Set<string>;
  retryDomain: (domain: string) => void;
}) {
  // 300ms minimum skeleton display to prevent "0 contacts" flash on tab switch
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  useEffect(() => {
    if (contactsLoading) {
      setMinTimeElapsed(false);
      const timer = setTimeout(() => setMinTimeElapsed(true), 300);
      return () => clearTimeout(timer);
    } else {
      setMinTimeElapsed(true);
    }
  }, [contactsLoading]);

  // Loading with no contacts yet
  if ((contactsLoading || !minTimeElapsed) && totalContactsDisplayed === 0) {
    return (
      <div className="space-y-1.5">
        <p className="mb-2 text-xs text-text-tertiary">Loading contacts...</p>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Done loading, no contacts — only show after minTimeElapsed to prevent flash
  if (!contactsLoading && minTimeElapsed && groupedContacts.length === 0) {
    if (failedDomains.size > 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-danger">All {failedDomains.size} company contact fetches failed</p>
          <button
            onClick={() => failedDomains.forEach((d) => retryDomain(d))}
            className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2"
          >
            Retry all
          </button>
        </div>
      );
    }
    return (
      <EmptyState
        title="No contacts available"
        description={pick("empty_contacts_list")}
      />
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Contact results"
      aria-activedescendant={focusedContactId ? `contact-${focusedContactId}` : undefined}
      tabIndex={0}
      className="space-y-3 focus:outline-none"
    >
      {/* Loading progress bar */}
      {contactsLoading && totalContactsDisplayed > 0 && (
        <div className="rounded-card border border-accent-primary/20 bg-accent-primary/5 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-accent-primary">
            <span>
              {fetchedCount}/{totalCount} companies loaded
            </span>
            <span className="text-text-tertiary">~{estimatedTotal} estimated contacts</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent-primary transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (fetchedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Failed domains banner */}
      {failedDomains.size > 0 && !contactsLoading && (
        <div className="rounded-card border border-danger/20 bg-danger-light px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-danger">
            {failedDomains.size} {failedDomains.size === 1 ? "company" : "companies"} failed to load contacts
          </span>
          <button
            onClick={() => failedDomains.forEach((d) => retryDomain(d))}
            className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-secondary hover:bg-surface-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Persona-grouped contact list */}
      {personaGroups.map((group) => {
        const isCollapsed = !!contactGroupsCollapsed[group.persona];
        const personaIcons: Record<string, string> = {
          decision_makers: "\u2605",
          influencers: "\u2192",
          operations: "\u2022",
        };

        return (
          <div key={group.persona} className="animate-fadeInUp">
            {/* Persona group header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 rounded bg-surface-0 px-1 py-1.5">
              <button
                onClick={() => toggleContactGroupCollapsed(group.persona)}
                className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
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
                  className={`flex-shrink-0 transition-transform duration-[180ms] ${isCollapsed ? "-rotate-90" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="text-sm font-semibold text-text-primary">
                  {personaIcons[group.persona] ?? ""} {group.label}
                </span>
              </button>
              <span className="font-mono text-[10px] text-text-tertiary">
                {group.contacts.length} contact{group.contacts.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Contact cards */}
            {!isCollapsed && (
              <div className="mt-1 space-y-1">
                {group.contacts.map((contact) => {
                  const company = companyByDomain.get(contact.companyDomain) ?? null;
                  return (
                    <ContactCard
                      key={`${group.persona}-${contact.id}`}
                      contact={contact}
                      isChecked={selectedContactIds.has(contact.id)}
                      onToggleCheck={() => toggleContactSelection(contact.id)}
                      isExpanded={expandedContactId === contact.id}
                      onToggleExpand={() =>
                        setExpandedContactId(
                          expandedContactId === contact.id ? null : contact.id
                        )
                      }
                      isFocused={focusedContactId === contact.id}
                      company={company}
                      visibleFields={contactVisibleFields}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Error Boundary for Contacts View
// ─────────────────────────────────────────────────────────
class ContactsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-card border border-danger/20 bg-surface-1 px-6 py-8">
          <p className="text-sm text-text-secondary">Something went wrong rendering contacts.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-2"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DemoResults({ onDismiss }: { onDismiss: () => void }) {
  const [mockCompanies, setMockCompanies] = useState<import("@/lib/navigator/types").CompanyEnriched[]>([]);
  const selectCompany = useStore((s) => s.selectCompany);
  const toggleCompanySelection = useStore((s) => s.toggleCompanySelection);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);

  useEffect(() => {
    import("@/lib/navigator/mock-data").then((mod) => {
      if (Array.isArray(mod.mockCompaniesEnriched)) {
        setMockCompanies(mod.mockCompaniesEnriched.slice(0, 5));
      }
    }).catch(() => {});
  }, []);

  if (mockCompanies.length === 0) return null;

  return (
    <div className="mt-8 w-full">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          Showing sample results — try your own search
        </p>
        <button
          onClick={onDismiss}
          className="text-[10px] text-text-tertiary hover:text-text-secondary"
        >
          Dismiss
        </button>
      </div>
      <div className="space-y-1.5 opacity-60">
        {mockCompanies.map((company) => (
          <CompanyCard
            key={company.domain}
            company={company}
            isSelected={selectedCompanyDomain === company.domain}
            isChecked={selectedCompanyDomains.has(company.domain)}
            onSelect={() => selectCompany(company.domain)}
            onToggleCheck={() => toggleCompanySelection(company.domain)}
          />
        ))}
      </div>
    </div>
  );
}
