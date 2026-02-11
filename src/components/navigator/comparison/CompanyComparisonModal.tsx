"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useStore } from "@/lib/navigator/store";
import { IcpScoreBadge } from "@/components/navigator/badges";
import { cn } from "@/lib/cn";
import type { CompanyEnriched, Contact } from "@/lib/navigator/types";
import { CompanyLogo } from "@/components/navigator/shared/CompanyLogo";

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

const crmLabels: Record<string, string> = {
  new_lead: "New Lead", contacted: "Contacted", negotiation: "Negotiation",
  won: "Won", lost: "Lost", customer: "Customer", open: "Open",
  in_progress: "In Progress", closed_won: "Won", closed_lost: "Lost", new: "New",
};

interface CompanyComparisonModalProps {
  domains: string[];
  onClose: () => void;
}

export function CompanyComparisonModal({ domains, onClose }: CompanyComparisonModalProps) {
  const searchResults = useStore((s) => s.searchResults);
  const companies = useStore((s) => s.companies);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const selectCompany = useStore((s) => s.selectCompany);

  const all = searchResults ?? companies;

  const companyData = useMemo(() => {
    const byDomain = new Map(all.map((c) => [c.domain, c]));
    return domains.map((d) => byDomain.get(d)).filter((c): c is CompanyEnriched => !!c);
  }, [domains, all]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCompanyClick = (domain: string) => {
    selectCompany(domain);
    onClose();
  };

  // Find best values for highlighting
  const maxIcp = Math.max(...companyData.map((c) => c.icpScore));
  const maxEmployees = Math.max(...companyData.map((c) => c.employeeCount ?? 0));
  const maxSignals = Math.max(...companyData.map((c) => c.signals.length));

  const labelClass = "px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider bg-surface-0 sticky left-0 z-10 whitespace-nowrap";
  const cellClass = "px-3 py-2 text-sm text-text-secondary";

  const highlightIf = (val: number, max: number) =>
    val === max && max > 0 ? "bg-accent-primary/10" : "";

  const topContact = (domain: string): Contact | undefined =>
    contactsByDomain[domain]?.find((c) => c.email);

  const sourceBadges = (c: CompanyEnriched) =>
    c.sources.map((s) => (
      <span
        key={s}
        className="inline-block rounded-pill border border-surface-3 bg-surface-2 px-1 py-px text-[9px] font-medium text-text-tertiary"
      >
        {s === "exa" ? "E" : s === "apollo" ? "A" : s === "hubspot" ? "H" : s === "freshsales" ? "F" : s[0]?.toUpperCase()}
      </span>
    ));

  const getCrmStatus = (c: CompanyEnriched) => {
    const status = c.freshsalesStatus !== "none" ? c.freshsalesStatus : c.hubspotStatus !== "none" ? c.hubspotStatus : null;
    if (!status) return null;
    return { status, colors: crmStatusColors[status], label: crmLabels[status] ?? status };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-4xl overflow-auto rounded-card border border-surface-3 bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
          <h2 className="font-display text-lg text-text-primary">Compare Companies</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={labelClass}></th>
                {companyData.map((c) => (
                  <th key={c.domain} className="px-3 py-3 text-left">
                    <button
                      onClick={() => handleCompanyClick(c.domain)}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <CompanyLogo logoUrl={c.logoUrl} domain={c.domain} name={c.name} size={20} className="h-5 w-5" />
                      <span className="max-w-[150px] truncate font-display text-sm font-semibold text-text-primary" title={c.name}>
                        {c.name}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>ICP Score</td>
                {companyData.map((c) => (
                  <td key={c.domain} className={cn(cellClass, highlightIf(c.icpScore, maxIcp))}>
                    <IcpScoreBadge score={c.icpScore} breakdown={c.icpBreakdown} showBreakdown />
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>Industry</td>
                {companyData.map((c) => (
                  <td key={c.domain} className={cellClass}>{c.industry}</td>
                ))}
              </tr>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>Employees</td>
                {companyData.map((c) => (
                  <td key={c.domain} className={cn(cellClass, "font-mono", highlightIf(c.employeeCount ?? 0, maxEmployees))}>
                    {c.employeeCount?.toLocaleString("en-US") ?? "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>Location</td>
                {companyData.map((c) => (
                  <td key={c.domain} className={cellClass}>{c.location}</td>
                ))}
              </tr>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>CRM Status</td>
                {companyData.map((c) => {
                  const crm = getCrmStatus(c);
                  return (
                    <td key={c.domain} className={cellClass}>
                      {crm ? (
                        <span
                          className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: crm.colors?.bg ?? "rgba(107,114,128,0.12)", color: crm.colors?.text ?? "#6b7280" }}
                        >
                          {crm.label}
                        </span>
                      ) : (
                        <span className="text-text-tertiary italic">None</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>Top Contact</td>
                {companyData.map((c) => {
                  const contact = topContact(c.domain);
                  return (
                    <td key={c.domain} className={cellClass}>
                      {contact ? (
                        <div className="text-xs">
                          <div className="font-medium text-text-primary">{contact.firstName} {contact.lastName}</div>
                          <div className="text-text-tertiary">{contact.email}</div>
                        </div>
                      ) : (
                        <span className="text-text-tertiary italic">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>Signals</td>
                {companyData.map((c) => (
                  <td key={c.domain} className={cn(cellClass, "font-mono", highlightIf(c.signals.length, maxSignals))}>
                    {c.signals.length || "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-3">
                <td className={labelClass}>Sources</td>
                {companyData.map((c) => (
                  <td key={c.domain} className={cellClass}>
                    <div className="flex items-center gap-1">{sourceBadges(c)}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
