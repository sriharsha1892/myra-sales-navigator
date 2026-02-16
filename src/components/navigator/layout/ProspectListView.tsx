"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/navigator/store";
import { CompanyCard } from "@/components/navigator/cards/CompanyCard";
import { InlineContacts } from "@/components/navigator/cards/InlineContacts";
import { EmptyState } from "@/components/navigator/shared";
import { pick } from "@/lib/navigator/ui-copy";
import type { CompanyEnriched } from "@/lib/navigator/types";

export function ProspectListView() {
  const prospectList = useStore((s) => s.prospectList);
  const removeFromProspectList = useStore((s) => s.removeFromProspectList);
  const clearProspectList = useStore((s) => s.clearProspectList);
  const searchResults = useStore((s) => s.searchResults);
  const companies = useStore((s) => s.companies);
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
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
      .filter((c): c is CompanyEnriched => !!c);
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
