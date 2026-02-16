"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { ContactRow } from "@/components/navigator/contacts/ContactRow";
import { OutreachDraftModal } from "@/components/navigator/outreach/OutreachDraftModal";
import { useOutreachSuggestion } from "@/lib/navigator/outreach/useOutreachSuggestion";
import { useExport } from "@/hooks/navigator/useExport";
import type { Contact } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";

const SENIORITY_ORDER: Record<string, number> = {
  c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
};

interface ContactsHeroSectionProps {
  contacts: Contact[];
  domain: string;
  isLoading?: boolean;
  contactsError?: string | null;
}

export function ContactsHeroSection({ contacts, domain, isLoading, contactsError }: ContactsHeroSectionProps) {
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);
  const selectedCompany = useStore((s) => s.selectedCompany);
  const updateContact = useStore((s) => s.updateContact);
  const addToast = useStore((s) => s.addToast);
  const company = selectedCompany();

  const warmActivityMap = useMemo(() => {
    const map = new Map<string, { type: string; daysAgo: number }>();
    const activities = company?.freshsalesIntel?.recentActivity;
    if (!activities) return map;
    const now = Date.now();
    for (const act of activities) {
      if (act.type !== "email" && act.type !== "call") continue;
      const daysAgo = Math.floor((now - new Date(act.date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo > 14) continue;
      if (!act.contactName) continue;
      const key = act.contactName.toLowerCase().trim();
      if (!map.has(key)) map.set(key, { type: act.type, daysAgo });
    }
    return map;
  }, [company?.freshsalesIntel?.recentActivity]);

  const [seniorityFilter, setSeniorityFilter] = useState<string>("all");
  const [hasEmailFilter, setHasEmailFilter] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "freshsales">("all");
  const [verifiedFilter, setVerifiedFilter] = useState(false);
  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [findingEmails, setFindingEmails] = useState(false);
  const suggestion = useOutreachSuggestion(company ?? null, draftContact, !!draftContact);
  const { executeExport } = useExport();

  // Fetch export history
  const { data: exportHistory } = useQuery({
    queryKey: ["export-history", domain],
    queryFn: async () => {
      const res = await fetch(`/api/contact/export-history?domain=${encodeURIComponent(domain)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.exports ?? []) as { contact_email: string; exported_by: string; exported_at: string }[];
    },
    staleTime: 30 * 1000,
  });

  const exportByEmail = useMemo(() => {
    const map = new Map<string, { exportedBy: string; exportedAt: string }>();
    if (exportHistory) {
      for (const e of exportHistory) {
        if (e.contact_email && !map.has(e.contact_email)) {
          map.set(e.contact_email, { exportedBy: e.exported_by, exportedAt: e.exported_at });
        }
      }
    }
    return map;
  }, [exportHistory]);

  const filtered = useMemo(() => {
    let result = contacts;
    if (seniorityFilter !== "all") {
      result = result.filter((c) => c.seniority === seniorityFilter);
    }
    if (hasEmailFilter) {
      result = result.filter((c) => !!c.email);
    }
    if (sourceFilter === "freshsales") {
      result = result.filter((c) => c.sources.includes("freshsales"));
    }
    if (verifiedFilter) {
      result = result.filter((c) => c.verificationStatus === "valid" || c.verificationStatus === "valid_risky");
    }
    return [...result].sort((a, b) => {
      const sa = SENIORITY_ORDER[a.seniority] ?? 5;
      const sb = SENIORITY_ORDER[b.seniority] ?? 5;
      if (sa !== sb) return sa - sb;
      return (b.emailConfidence ?? 0) - (a.emailConfidence ?? 0);
    });
  }, [contacts, seniorityFilter, hasEmailFilter, sourceFilter, verifiedFilter]);

  const isFiltered = seniorityFilter !== "all" || hasEmailFilter || sourceFilter !== "all" || verifiedFilter;

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedContactIds.has(c.id));
  const toggleAll = useCallback(() => {
    if (allSelected) {
      for (const c of filtered) {
        if (selectedContactIds.has(c.id)) toggleContactSelection(c.id);
      }
    } else {
      for (const c of filtered) {
        if (!selectedContactIds.has(c.id)) toggleContactSelection(c.id);
      }
    }
  }, [allSelected, filtered, selectedContactIds, toggleContactSelection]);

  const missingEmailContacts = useMemo(
    () =>
      contacts
        .filter((c) => !c.email)
        .sort((a, b) => (SENIORITY_ORDER[a.seniority] ?? 5) - (SENIORITY_ORDER[b.seniority] ?? 5))
        .slice(0, 10),
    [contacts]
  );

  const handleFindMissingEmails = useCallback(async () => {
    if (findingEmails || missingEmailContacts.length === 0) return;
    setFindingEmails(true);
    try {
      const res = await fetch("/api/contact/find-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          contacts: missingEmailContacts.map((c) => ({
            contactId: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
          })),
        }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      const results = data.results ?? [];
      let foundCount = 0;

      for (const r of results) {
        if (r.status === "found" && r.email) {
          foundCount++;
          const original = contacts.find((c) => c.id === r.contactId);
          if (original) {
            const updated: Contact = {
              ...original,
              email: r.email,
              emailConfidence: r.confidence ?? 70,
              confidenceLevel: r.confidence >= 80 ? "high" : "medium",
            };
            updateContact(domain, r.contactId, updated);
            fetch("/api/contact/persist-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                domain,
                contactId: r.contactId,
                email: r.email,
                emailConfidence: r.confidence ?? 70,
                confidenceLevel: r.confidence >= 80 ? "high" : "medium",
              }),
            }).catch(() => {});
          }
        }
      }

      addToast({
        message: `Found ${foundCount} of ${missingEmailContacts.length} emails`,
        type: foundCount > 0 ? "success" : "info",
      });
    } catch {
      addToast({ message: "Failed to find emails", type: "error" });
    } finally {
      setFindingEmails(false);
    }
  }, [findingEmails, missingEmailContacts, domain, contacts, updateContact, addToast]);

  return (
    <div className="border-t border-surface-3">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Contacts
        </span>
        <span className="text-[10px] tabular-nums text-text-tertiary">
          ({isLoading && contacts.length === 0 ? "..." : contacts.length})
        </span>

        {/* Select all */}
        {filtered.length > 0 && (
          <label className="flex cursor-pointer items-center gap-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3 w-3 rounded accent-accent-primary"
            />
            <span className="text-[10px] text-text-tertiary">All</span>
          </label>
        )}

        {/* Find missing emails */}
        {missingEmailContacts.length > 0 && (
          <button
            onClick={handleFindMissingEmails}
            disabled={findingEmails}
            className="flex items-center gap-1 rounded-input border border-accent-secondary/30 bg-accent-secondary/5 px-2 py-0.5 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {findingEmails ? (
              <>
                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-accent-secondary/30 border-t-accent-secondary" />
                Finding...
              </>
            ) : (
              `Find ${missingEmailContacts.length} emails`
            )}
          </button>
        )}

        {/* Export all */}
        {contacts.length > 0 && (
          <button
            onClick={() => executeExport(contacts, "clipboard")}
            className="rounded-input border border-surface-3 px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-2"
          >
            Export
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <select
            value={seniorityFilter}
            onChange={(e) => setSeniorityFilter(e.target.value)}
            aria-label="Filter by seniority level"
            className="rounded-input border border-surface-3 bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
          >
            <option value="all">All levels</option>
            <option value="c_level">C-Level</option>
            <option value="vp">VP</option>
            <option value="director">Director</option>
            <option value="manager">Manager</option>
          </select>
          <button
            onClick={() => setHasEmailFilter((v) => !v)}
            className={`rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors duration-[180ms] ${
              hasEmailFilter
                ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Has email
          </button>
          <button
            onClick={() => setSourceFilter((v) => v === "freshsales" ? "all" : "freshsales")}
            className={`rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors duration-[180ms] ${
              sourceFilter === "freshsales"
                ? "border-source-freshsales/30 bg-source-freshsales/10 text-source-freshsales"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            }`}
          >
            CRM
          </button>
          <button
            onClick={() => setVerifiedFilter((v) => !v)}
            className={`rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors duration-[180ms] ${
              verifiedFilter
                ? "border-success/30 bg-success/10 text-success"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Verified
          </button>
          {isFiltered && (
            <span className="text-[10px] text-text-tertiary">
              {filtered.length}/{contacts.length}
            </span>
          )}
        </div>
      </div>

      {/* Contact list with capped height */}
      <div className="max-h-[420px] overflow-y-auto px-4 pb-3">
        {isLoading && contacts.length === 0 ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-card bg-surface-2 shimmer" />
            ))}
          </div>
        ) : contactsError ? (
          <div className="rounded-input border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">
            Failed to load contacts. Other sections are still available.
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-3 text-xs text-text-tertiary italic">
            {contacts.length === 0
              ? pick("empty_dossier_contacts")
              : pick("empty_contacts_filtered")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((contact) => {
              const contactFullName = `${contact.firstName} ${contact.lastName}`.toLowerCase().trim();
              const warmActivity = warmActivityMap.get(contactFullName);
              return (
                <div key={contact.id} id={`contact-${contact.id}`}>
                  <ContactRow
                    contact={contact}
                    selected={selectedContactIds.has(contact.id)}
                    isFocused={false}
                    variant="expanded"
                    onToggle={() => toggleContactSelection(contact.id)}
                    onDraftEmail={() => setDraftContact(contact)}
                    exportInfo={contact.email ? exportByEmail.get(contact.email) : undefined}
                    warmActivity={warmActivity}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selection action bar */}
      {selectedContactIds.size > 0 && filtered.some((c) => selectedContactIds.has(c.id)) && (
        <div className="mx-4 mb-3 flex items-center justify-between rounded-card border border-surface-3 bg-surface-0 px-3 py-2">
          <span className="text-[10px] font-medium text-text-secondary">
            {filtered.filter((c) => selectedContactIds.has(c.id)).length} selected
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => executeExport(filtered.filter((c) => selectedContactIds.has(c.id)), "clipboard")}
              className="rounded-input bg-accent-primary px-2.5 py-1 text-[10px] font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover"
            >
              Copy
            </button>
            <button
              onClick={() => executeExport(filtered.filter((c) => selectedContactIds.has(c.id)), "csv")}
              className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            >
              CSV
            </button>
          </div>
        </div>
      )}

      {draftContact && company && (
        <OutreachDraftModal
          contact={draftContact}
          company={company}
          onClose={() => setDraftContact(null)}
          suggestedChannel={suggestion?.channel}
          suggestedTemplate={suggestion?.template as import("@/lib/navigator/types").EmailTemplate | undefined}
          suggestedTone={suggestion?.tone}
          suggestionReason={suggestion?.reason}
        />
      )}
    </div>
  );
}
