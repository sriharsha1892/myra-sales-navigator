"use client";

import { useStore } from "@/lib/store";
import { CompanyCard } from "@/components/cards/CompanyCard";
import { ContactCard } from "@/components/cards/ContactCard";
import { SkeletonCard } from "@/components/cards/SkeletonCard";
import { ViewToggle, QuickFilterChips, ResultFilterChips, EmptyState } from "@/components/shared";
import type { SortField } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { timeAgo } from "@/lib/utils";

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
  const contactsByDomain = useStore((s) => s.contactsByDomain);

  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("nav_onboarded")) {
      setShowOnboarding(true);
    }
  }, []);
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("nav_onboarded", "1");
  };

  const companies = filteredCompanies();

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (viewMode !== "companies") return;
      const currentCompanies = filteredCompanies();
      if (currentCompanies.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "j" || e.key === "k") {
        e.preventDefault();
        const currentIdx = currentCompanies.findIndex(
          (c) => c.domain === selectedCompanyDomain
        );
        let nextIdx: number;
        if (e.key === "ArrowDown" || e.key === "j") {
          nextIdx = currentIdx < currentCompanies.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : currentCompanies.length - 1;
        }
        const nextDomain = currentCompanies[nextIdx].domain;
        selectCompany(nextDomain);
        document
          .getElementById(`company-${nextDomain}`)
          ?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (e.key === " " || e.key === "x") {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement && active.type === "checkbox") return;
        e.preventDefault();
        if (selectedCompanyDomain) {
          toggleCompanySelection(selectedCompanyDomain);
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedCompanyDomain) {
          selectCompany(selectedCompanyDomain);
        }
        return;
      }
    },
    [viewMode, filteredCompanies, selectedCompanyDomain, selectCompany, toggleCompanySelection]
  );

  const allContacts = Object.values(contactsByDomain).flat();
  const seniorityOrder: Record<string, number> = {
    c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
  };
  const sortedContacts = [...allContacts].sort((a, b) => {
    const sa = seniorityOrder[a.seniority] ?? 5;
    const sb = seniorityOrder[b.seniority] ?? 5;
    if (sa !== sb) return sa - sb;
    return b.emailConfidence - a.emailConfidence;
  });

  const count = viewMode === "companies" ? companies.length : sortedContacts.length;
  const hasSearched = searchResults !== null;

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface-0">
      {/* Top bar */}
      <div className="relative glass-topbar flex flex-shrink-0 flex-wrap items-center gap-3 px-4 py-2.5">
        {searchLoading && (
          <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-accent-primary/10">
            <div className="h-full w-1/4 bg-accent-primary" style={{ animation: "progressSlide 1.2s ease-in-out infinite" }} />
          </div>
        )}
        <ViewToggle value={viewMode} onChange={setViewMode} />
        <span className="font-mono text-xs text-text-tertiary">
          {count} {viewMode === "companies" ? "companies" : "contacts"}
        </span>
        {viewMode === "companies" && companies.length > 0 && (() => {
          const avg = Math.round(companies.reduce((s, c) => s + c.icpScore, 0) / companies.length);
          const color = avg >= 70 ? "text-success" : avg >= 50 ? "text-warning" : "text-text-tertiary";
          return (
            <span className={`rounded-pill border border-surface-3 px-2 py-0.5 font-mono text-[10px] ${color}`}>
              Avg match: {avg}
            </span>
          );
        })()}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Sort:</span>
          <select
            value={sortField}
            onChange={(e) => handleSortChange(e.target.value as SortField)}
            className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          >
            <option value="icp_score">ICP Score</option>
            <option value="name">Name</option>
            <option value="employee_count">Size</option>
          </select>
          <button
            onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
            className="text-xs text-text-tertiary hover:text-text-primary"
            title={sortDirection === "desc" ? "Descending" : "Ascending"}
          >
            {sortDirection === "desc" ? "\u2193" : "\u2191"}
          </button>
        </div>
      </div>

      {/* Filter chips — single merged row, only shown after first search */}
      {hasSearched && !searchLoading && (
        <div className="glass-subtle flex flex-shrink-0 flex-wrap gap-1.5 border-b border-surface-3 px-4 py-2">
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
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Loading skeletons */}
        {searchLoading ? (
          <div className="space-y-2">
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
            <p className="animate-fadeInUp mt-1.5 text-xs italic text-text-tertiary" style={{ animationDelay: "80ms" }}>
              Pro tip: Press &#8984;K to search by description — like &ldquo;food companies expanding to Asia&rdquo;
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {exampleQueries.map((query, i) => (
                <button
                  key={query}
                  onClick={() => setPendingFreeTextSearch(query)}
                  className="animate-fadeInUp rounded-pill border border-surface-3 bg-surface-1 px-5 py-2.5 text-sm font-medium text-text-secondary shadow-sm transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-md hover:text-text-primary"
                  style={{ animationDelay: `${120 + i * 60}ms` }}
                >
                  {query}
                </button>
              ))}
            </div>
            {history.length > 0 && (
              <div className="mt-8 w-full max-w-md">
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                  Recent Searches
                </p>
                <div className="space-y-1">
                  {history.slice(0, 5).map((entry) => {
                    const handleClick = () => {
                      const f = entry.filters;
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
                        setPendingFreeTextSearch(entry.label ?? "");
                      }
                    };
                    return (
                      <button
                        key={entry.id}
                        onClick={handleClick}
                        className="flex w-full items-center justify-between rounded-card border border-surface-3 bg-surface-1 px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-surface-2"
                      >
                        <span className="truncate">{entry.label ?? "Search"}</span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono text-[10px] text-text-tertiary">{entry.resultCount} results</span>
                          <span className="text-[10px] text-text-tertiary">{timeAgo(entry.timestamp)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : viewMode === "companies" ? (
          companies.length === 0 ? (
            <EmptyState
              title="No matches found"
              description="Try removing some filters, or search for a broader term like 'chemicals' instead of a specific company."
            />
          ) : (
            <div
              role="listbox"
              aria-label="Company results"
              aria-activedescendant={
                selectedCompanyDomain ? `company-${selectedCompanyDomain}` : undefined
              }
              tabIndex={0}
              onKeyDown={handleListKeyDown}
              className="space-y-2 focus:outline-none"
            >
              {sortField === "icp_score" ? (() => {
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
                      <div className="sticky top-0 z-10 rounded bg-surface-0/90 px-1 py-1.5 backdrop-blur-sm">
                        <span className={`text-sm font-semibold uppercase tracking-wide ${tier.color}`}>
                          {tier.label}
                        </span>
                        <span className="ml-1.5 font-mono text-[10px] text-text-tertiary">
                          {tier.min}–{tier.max} ({tierCompanies.length})
                        </span>
                      </div>
                      <div className="space-y-2">
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
              })() : companies.map((company, index) => (
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
          )
        ) : sortedContacts.length === 0 ? (
          <EmptyState
            title="No contacts available"
            description="No contacts available for current results."
          />
        ) : (
          <div role="listbox" aria-label="Contact results" className="space-y-2">
            {sortedContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                isChecked={selectedContactIds.has(contact.id)}
                onToggleCheck={() => toggleContactSelection(contact.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
