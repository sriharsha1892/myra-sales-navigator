"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/navigator/store";
import { cn } from "@/lib/cn";
import type { Contact } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";

const SENIORITY_ORDER: Record<string, number> = {
  c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
};

const SENIORITY_CHIP_COLORS: Record<string, string> = {
  c_level: "bg-seniority-clevel/15 text-seniority-clevel border-seniority-clevel/30",
  vp: "bg-seniority-vp/15 text-seniority-vp border-seniority-vp/30",
  director: "bg-seniority-director/15 text-seniority-director border-seniority-director/30",
  manager: "bg-surface-2 text-text-secondary border-surface-3",
  staff: "bg-surface-2 text-text-tertiary border-surface-3",
};

const SENIORITY_LABELS: Record<string, string> = {
  c_level: "C-Level",
  vp: "VP",
  director: "Director",
  manager: "Manager",
  staff: "Staff",
};

type SortKey = "seniority" | "company" | "name";

function getVerificationColor(contact: Contact): string {
  switch (contact.verificationStatus) {
    case "valid":
      return "bg-success";
    case "valid_risky":
      return "bg-warning";
    case "invalid":
      return "bg-danger";
    default:
      return "bg-text-tertiary";
  }
}

function getVerificationLabel(contact: Contact): string {
  switch (contact.verificationStatus) {
    case "valid":
      return "Verified";
    case "valid_risky":
      return "Risky";
    case "invalid":
      return "Invalid";
    default:
      return "Unchecked";
  }
}

export function AllContactsView() {
  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);

  const [sortBy, setSortBy] = useState<SortKey>("seniority");

  const companies = filteredCompanies();

  const { contacts, companyCount } = useMemo(() => {
    const result: (Contact & { _companyName: string })[] = [];
    let count = 0;
    for (const company of companies) {
      const domainContacts = contactsByDomain[company.domain];
      if (domainContacts && domainContacts.length > 0) {
        count++;
        for (const c of domainContacts) {
          result.push({ ...c, _companyName: c.companyName || company.name });
        }
      }
    }
    return { contacts: result, companyCount: count };
  }, [companies, contactsByDomain]);

  const sorted = useMemo(() => {
    const arr = [...contacts];
    switch (sortBy) {
      case "seniority":
        arr.sort((a, b) => {
          const sa = SENIORITY_ORDER[a.seniority] ?? 5;
          const sb = SENIORITY_ORDER[b.seniority] ?? 5;
          if (sa !== sb) return sa - sb;
          return b.emailConfidence - a.emailConfidence;
        });
        break;
      case "company":
        arr.sort((a, b) => a._companyName.localeCompare(b._companyName));
        break;
      case "name":
        arr.sort((a, b) => {
          const nameA = `${a.firstName} ${a.lastName}`;
          const nameB = `${b.firstName} ${b.lastName}`;
          return nameA.localeCompare(nameB);
        });
        break;
    }
    return arr;
  }, [contacts, sortBy]);

  if (contacts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-sm italic text-text-tertiary">
          {pick("empty_contacts_all")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          <span className="font-mono font-semibold text-text-primary">
            {contacts.length}
          </span>{" "}
          contacts across{" "}
          <span className="font-mono font-semibold text-text-primary">
            {companyCount}
          </span>{" "}
          companies
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Sort
          </span>
          {(["seniority", "company", "name"] as SortKey[]).map((key, i) => (
            <span key={key} className="flex items-center">
              {i > 0 && (
                <span className="mx-1 text-text-tertiary/40">&middot;</span>
              )}
              <button
                onClick={() => setSortBy(key)}
                className={cn(
                  "text-xs transition-colors duration-[180ms]",
                  sortBy === key
                    ? "font-semibold text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-0.5">
        {sorted.map((contact) => (
          <div
            key={contact.id}
            className={cn(
              "flex items-center gap-2.5 rounded-card border px-3 py-2 transition-all duration-[180ms]",
              selectedContactIds.has(contact.id)
                ? "border-accent-primary/30 bg-accent-primary-light"
                : "border-surface-3 bg-surface-1 hover:shadow-sm"
            )}
          >
            <button
              onClick={() => toggleContactSelection(contact.id)}
              className={cn(
                "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded transition-all duration-150",
                selectedContactIds.has(contact.id)
                  ? "bg-accent-primary text-white"
                  : "border border-surface-3 hover:border-accent-primary"
              )}
            >
              {selectedContactIds.has(contact.id) && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            <span className="w-32 truncate text-sm font-medium text-text-primary">
              {contact.firstName} {contact.lastName}
            </span>

            <span className="w-28 truncate text-xs text-text-secondary">
              {contact._companyName}
            </span>

            <span className="min-w-0 flex-1 truncate text-xs text-text-tertiary">
              {contact.title}
            </span>

            <span
              className={cn(
                "flex-shrink-0 rounded-pill border px-1.5 py-0.5 text-[9px] font-medium",
                SENIORITY_CHIP_COLORS[contact.seniority] ??
                  SENIORITY_CHIP_COLORS.staff
              )}
            >
              {SENIORITY_LABELS[contact.seniority] ?? contact.seniority}
            </span>

            <span className="w-44 truncate font-mono text-xs text-text-secondary">
              {contact.email ?? "\u2014"}
            </span>

            <div className="flex flex-shrink-0 items-center gap-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  getVerificationColor(contact)
                )}
              />
              <span className="text-[9px] text-text-tertiary">
                {getVerificationLabel(contact)}
              </span>
            </div>

            {contact.sources.includes("freshsales") && (
              <span className="flex-shrink-0 rounded-pill bg-[#c9a227]/15 px-1.5 py-0.5 text-[8px] font-semibold text-[#c9a227]">
                Warm
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
