"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { CompanyEnriched, Contact } from "@/lib/navigator/types";
import { IcpScoreBadge } from "@/components/navigator/badges";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import { logEmailCopy } from "@/lib/navigator/logEmailCopy";
import { useStore } from "@/lib/navigator/store";
import { isStale } from "@/lib/navigator/staleness";

type SortField = "name" | "icp_score" | "industry" | "employee_count" | "location" | "signals";
type SortDir = "asc" | "desc";

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
  new_lead: "New Lead",
  contacted: "Contacted",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  customer: "Customer",
  open: "Open",
  in_progress: "In Progress",
  closed_won: "Won",
  closed_lost: "Lost",
  new: "New",
};

interface CompanyTableProps {
  companies: CompanyEnriched[];
  selectedCompanyDomain: string | null;
  selectedCompanyDomains: Set<string>;
  contactsByDomain: Record<string, Contact[]>;
  onSelectCompany: (domain: string) => void;
  onToggleCheck: (domain: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function CompanyTable({
  companies,
  selectedCompanyDomain,
  selectedCompanyDomains,
  contactsByDomain,
  onSelectCompany,
  onToggleCheck,
  onSelectAll,
  onDeselectAll,
}: CompanyTableProps) {
  const [sortField, setSortField] = useState<SortField>("icp_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const addToast = useStore((s) => s.addToast);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const sorted = useMemo(() => {
    const arr = [...companies];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "icp_score": cmp = a.icpScore - b.icpScore; break;
        case "industry": cmp = (a.industry ?? "").localeCompare(b.industry ?? ""); break;
        case "employee_count": cmp = (a.employeeCount ?? 0) - (b.employeeCount ?? 0); break;
        case "location": cmp = (a.location ?? "").localeCompare(b.location ?? ""); break;
        case "signals": cmp = a.signals.length - b.signals.length; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [companies, sortField, sortDir]);

  const allChecked = companies.length > 0 && selectedCompanyDomains.size === companies.length;

  const handleCopyEmail = useCallback((e: React.MouseEvent, email: string, name: string, domain: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email).then(() => {
      setCopiedDomain(domain);
      addToast({ message: `Copied ${email}`, type: "success", duration: 1500, dedupKey: "table-copy" });
      setTimeout(() => setCopiedDomain(null), 1500);
      logEmailCopy(email, name, domain);
    });
  }, [addToast]);

  const thClass = "sticky top-0 z-10 bg-surface-0 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-tertiary cursor-pointer select-none hover:text-text-secondary transition-colors border-b border-surface-3";
  const tdClass = "px-2 py-1.5 text-xs text-text-secondary whitespace-nowrap";

  return (
    <div className="overflow-auto rounded-card border border-surface-3">
      <table className="w-full min-w-[800px] border-collapse">
        <thead>
          <tr>
            <th className={cn(thClass, "w-8")}>
              <button
                onClick={allChecked ? onDeselectAll : onSelectAll}
                className={cn(
                  "flex h-3 w-3 items-center justify-center rounded transition-all",
                  allChecked ? "bg-accent-primary text-white" : "border border-surface-3 hover:border-accent-primary"
                )}
                aria-label={allChecked ? "Deselect all" : "Select all"}
              >
                {allChecked && (
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </th>
            <th className={thClass} onClick={() => toggleSort("name")}>Company<SortIcon field="name" sortField={sortField} sortDir={sortDir} /></th>
            <th className={cn(thClass, "w-16")} onClick={() => toggleSort("icp_score")}>ICP<SortIcon field="icp_score" sortField={sortField} sortDir={sortDir} /></th>
            <th className={thClass} onClick={() => toggleSort("industry")}>Industry<SortIcon field="industry" sortField={sortField} sortDir={sortDir} /></th>
            <th className={cn(thClass, "w-20")} onClick={() => toggleSort("employee_count")}>Employees<SortIcon field="employee_count" sortField={sortField} sortDir={sortDir} /></th>
            <th className={thClass} onClick={() => toggleSort("location")}>Location<SortIcon field="location" sortField={sortField} sortDir={sortDir} /></th>
            <th className={cn(thClass, "w-24")}>CRM</th>
            <th className={cn(thClass, "w-48")}>Top Contact</th>
            <th className={cn(thClass, "w-16")} onClick={() => toggleSort("signals")}>Signals<SortIcon field="signals" sortField={sortField} sortDir={sortDir} /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((company) => {
            const isSelected = selectedCompanyDomain === company.domain;
            const isChecked = selectedCompanyDomains.has(company.domain);
            const contacts = contactsByDomain[company.domain];
            const topContact = contacts?.find((c) => c.email);
            const crmStatus = company.freshsalesStatus !== "none" ? company.freshsalesStatus : company.hubspotStatus !== "none" ? company.hubspotStatus : null;
            const stale = isStale(company.lastRefreshed);

            return (
              <tr
                key={company.domain}
                onClick={() => onSelectCompany(company.domain)}
                className={cn(
                  "cursor-pointer border-b border-surface-3 transition-colors",
                  isSelected ? "bg-accent-primary-light" : "bg-surface-1 hover:bg-surface-2",
                  isChecked && "ring-1 ring-inset ring-accent-highlight/30"
                )}
              >
                <td className={tdClass}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleCheck(company.domain); }}
                    className={cn(
                      "flex h-3 w-3 items-center justify-center rounded transition-all",
                      isChecked ? "bg-accent-primary text-white" : "border border-surface-3 hover:border-accent-primary"
                    )}
                    aria-label={isChecked ? `Deselect ${company.name}` : `Select ${company.name}`}
                  >
                    {isChecked && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className={cn(tdClass, "text-text-primary font-medium")}>
                  <div className="flex items-center gap-1.5">
                    <img
                      src={company.logoUrl ?? `https://www.google.com/s2/favicons?domain=${company.domain}&sz=32`}
                      alt=""
                      width={16}
                      height={16}
                      className="h-4 w-4 flex-shrink-0 rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="max-w-[180px] truncate" title={company.name}>{company.name}</span>
                    {stale && (
                      <Tooltip text={`Data is ${formatTimeAgo(company.lastRefreshed)} old`}>
                        <span className="flex-shrink-0 text-[9px] text-warning">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-px mr-px"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          24h+
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </td>
                <td className={tdClass}>
                  <IcpScoreBadge score={company.icpScore} breakdown={company.icpBreakdown} showBreakdown />
                </td>
                <td className={tdClass}>
                  <span className="max-w-[120px] truncate inline-block" title={company.industry}>{company.industry}</span>
                </td>
                <td className={cn(tdClass, "font-mono")}>{company.employeeCount?.toLocaleString("en-US") ?? "—"}</td>
                <td className={tdClass}>
                  <span className="max-w-[100px] truncate inline-block" title={company.location}>{company.location}</span>
                </td>
                <td className={tdClass}>
                  {crmStatus && (
                    <span
                      className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: crmStatusColors[crmStatus]?.bg ?? "rgba(107,114,128,0.12)",
                        color: crmStatusColors[crmStatus]?.text ?? "#6b7280",
                      }}
                    >
                      {crmLabels[crmStatus] ?? crmStatus}
                    </span>
                  )}
                </td>
                <td className={tdClass}>
                  {topContact ? (
                    <div className="flex items-center gap-1">
                      <span className="max-w-[100px] truncate" title={topContact.email ?? undefined}>
                        {topContact.email}
                      </span>
                      <Tooltip text="Copy email">
                        <button
                          onClick={(e) => handleCopyEmail(e, topContact.email!, `${topContact.firstName} ${topContact.lastName}`, company.domain)}
                          className="flex-shrink-0 text-text-tertiary transition-colors hover:text-accent-primary"
                          aria-label="Copy email"
                        >
                          {copiedDomain === company.domain ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  ) : (
                    <span className="text-text-tertiary italic">—</span>
                  )}
                </td>
                <td className={cn(tdClass, "font-mono")}>{company.signals.length || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <span className="ml-0.5 text-text-tertiary/30">&#8597;</span>;
  return <span className="ml-0.5 text-accent-primary">{sortDir === "desc" ? "\u2193" : "\u2191"}</span>;
}

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diffMs)) return "unknown";
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
