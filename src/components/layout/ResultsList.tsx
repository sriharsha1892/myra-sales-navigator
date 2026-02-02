"use client";

import { useStore } from "@/lib/store";
import { CompanyCard } from "@/components/cards/CompanyCard";
import { ContactCard } from "@/components/cards/ContactCard";
import { ViewToggle, QuickFilterChips, EmptyState } from "@/components/shared";
import type { SortField } from "@/lib/types";
import { useCallback } from "react";

export function ResultsList() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const sortField = useStore((s) => s.sortField);
  const sortDirection = useStore((s) => s.sortDirection);
  const setSortField = useStore((s) => s.setSortField);
  const setSortDirection = useStore((s) => s.setSortDirection);
  const searchError = useStore((s) => s.searchError);

  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);
  const toggleCompanySelection = useStore((s) => s.toggleCompanySelection);
  const contactsByDomain = useStore((s) => s.contactsByDomain);

  const companies = filteredCompanies();

  // Split by source for company view
  const exaCompanies = companies.filter((c) => c.sources.includes("exa"));
  const apolloCompanies = companies.filter((c) => !c.sources.includes("exa"));

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (viewMode !== "companies") return;
      const currentCompanies = filteredCompanies();
      if (currentCompanies.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = currentCompanies.findIndex(
          (c) => c.domain === selectedCompanyDomain
        );
        let nextIdx: number;
        if (e.key === "ArrowDown") {
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

      if (e.key === " ") {
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
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-surface-3 bg-surface-1 px-4 py-2.5">
        <ViewToggle value={viewMode} onChange={setViewMode} />
        <span className="font-mono text-xs text-text-tertiary">
          {count} {viewMode === "companies" ? "companies" : "contacts"}
        </span>
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

      {/* Quick filter chips */}
      <div className="flex-shrink-0 border-b border-surface-3 bg-surface-1 px-4 py-2">
        <QuickFilterChips />
      </div>

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
        {viewMode === "companies" ? (
          companies.length === 0 ? (
            <EmptyState
              title="No companies found"
              description="No matches found. Try broadening your vertical or region filters."
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
              {/* Semantic Matches (Exa) */}
              {exaCompanies.length > 0 && (
                <>
                  <SectionHeader label="Semantic Matches (Exa)" count={exaCompanies.length} />
                  {exaCompanies.map((company) => (
                    <CompanyCard
                      key={company.domain}
                      company={company}
                      isSelected={selectedCompanyDomain === company.domain}
                      isChecked={selectedCompanyDomains.has(company.domain)}
                      onSelect={() => selectCompany(company.domain)}
                      onToggleCheck={() => toggleCompanySelection(company.domain)}
                    />
                  ))}
                </>
              )}

              {/* Structured Matches (Apollo) */}
              {apolloCompanies.length > 0 && (
                <>
                  <SectionHeader label="Structured Matches (Apollo)" count={apolloCompanies.length} />
                  {apolloCompanies.map((company) => (
                    <CompanyCard
                      key={company.domain}
                      company={company}
                      isSelected={selectedCompanyDomain === company.domain}
                      isChecked={selectedCompanyDomains.has(company.domain)}
                      onSelect={() => selectCompany(company.domain)}
                      onToggleCheck={() => toggleCompanySelection(company.domain)}
                    />
                  ))}
                </>
              )}
            </div>
          )
        ) : sortedContacts.length === 0 ? (
          <EmptyState
            title="No contacts found"
            description="No contacts match current filters. Try adjusting source or confidence filters."
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

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-surface-3" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <span className="font-mono text-[10px] text-text-tertiary">{count}</span>
      <div className="h-px flex-1 bg-surface-3" />
    </div>
  );
}
