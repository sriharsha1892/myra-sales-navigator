"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/cn";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { OutreachDraftModal } from "@/components/navigator/outreach/OutreachDraftModal";
import { useOutreachSuggestion } from "@/lib/navigator/outreach/useOutreachSuggestion";
import { ContactRow } from "@/components/navigator/contacts/ContactRow";
import { useExport } from "@/hooks/navigator/useExport";
import type { Contact } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";

const seniorityOrder: Record<string, number> = { c_level: 0, vp: 1, director: 2, manager: 3, staff: 4 };

interface DossierContactsProps {
  companyDomain: string;
  contacts?: Contact[];
}

export function DossierContacts({ companyDomain, contacts: contactsProp }: DossierContactsProps) {
  const companyContacts = useStore((s) => s.companyContacts);
  const selectedCompany = useStore((s) => s.selectedCompany);
  const addToast = useStore((s) => s.addToast);
  const updateContact = useStore((s) => s.updateContact);
  const contacts = contactsProp ?? companyContacts(companyDomain);
  const company = selectedCompany();

  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const suggestion = useOutreachSuggestion(company, draftContact, !!draftContact);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [findingEmails, setFindingEmails] = useState(false);
  const [dossierSourceFilter, setDossierSourceFilter] = useState<"all" | "freshsales" | "new">("all");
  const [dossierEmailOnly, setDossierEmailOnly] = useState(true);

  // Fetch export history for this domain
  const { data: exportHistory } = useQuery({
    queryKey: ["export-history", companyDomain],
    queryFn: async () => {
      const res = await fetch(`/api/contact/export-history?domain=${encodeURIComponent(companyDomain)}`);
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

  const { executeExport } = useExport();

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const getSelectedContacts = () => contacts.filter((c) => selectedIds.has(c.id));

  const missingEmailContacts = useMemo(
    () =>
      contacts
        .filter((c) => !c.email)
        .sort((a, b) => (seniorityOrder[a.seniority] ?? 5) - (seniorityOrder[b.seniority] ?? 5))
        .slice(0, 10),
    [contacts]
  );

  const displayContacts = useMemo(() => {
    let result = contacts;
    if (dossierSourceFilter === "freshsales") result = result.filter(c => c.sources.includes("freshsales"));
    if (dossierSourceFilter === "new") result = result.filter(c => !c.sources.includes("freshsales"));
    if (dossierEmailOnly) result = result.filter(c => !!c.email);
    return [...result].sort((a, b) => {
      const sa = seniorityOrder[a.seniority] ?? 5;
      const sb = seniorityOrder[b.seniority] ?? 5;
      if (sa !== sb) return sa - sb;
      return b.emailConfidence - a.emailConfidence;
    });
  }, [contacts, dossierSourceFilter, dossierEmailOnly]);

  const isFiltered = dossierSourceFilter !== "all" || dossierEmailOnly;

  const handleFindMissingEmails = useCallback(async () => {
    if (findingEmails || missingEmailContacts.length === 0) return;
    setFindingEmails(true);
    try {
      const res = await fetch("/api/contact/find-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: companyDomain,
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
            updateContact(companyDomain, r.contactId, updated);

            // Persist to server cache (fire-and-forget)
            fetch("/api/contact/persist-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                domain: companyDomain,
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
  }, [findingEmails, missingEmailContacts, companyDomain, contacts, updateContact, addToast]);

  return (
    <div className="rounded-card bg-surface-0/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 aria-live="polite" className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Contacts ({contacts.length})
        </h3>
        <div className="flex items-center gap-2">
          {missingEmailContacts.length > 0 && (
            <button
              onClick={handleFindMissingEmails}
              disabled={findingEmails}
              className="flex items-center gap-1 rounded-input border border-accent-secondary/30 bg-accent-secondary/5 px-2 py-0.5 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {findingEmails ? (
                <>
                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-accent-secondary/30 border-t-accent-secondary" />
                  Finding emails...
                </>
              ) : (
                `Find ${missingEmailContacts.length} missing emails`
              )}
            </button>
          )}
          {contacts.length > 0 && (
            <>
              <button
                onClick={() => {
                  setSelectedIds(new Set(contacts.map((c) => c.id)));
                  executeExport(contacts, "clipboard");
                }}
                className="rounded-input border border-surface-3 px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-2"
              >
                Export
              </button>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={selectedIds.size === contacts.length && contacts.length > 0}
                  onChange={toggleAll}
                  className="h-3 w-3 rounded accent-accent-primary"
                />
                <span className="text-[10px] text-text-tertiary">All</span>
              </label>
            </>
          )}
        </div>
      </div>
      {contacts.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5">
          <button
            onClick={() => setDossierSourceFilter(v => v === "all" ? "freshsales" : v === "freshsales" ? "new" : "all")}
            className="rounded-pill border border-surface-3 px-1.5 py-0.5 text-[9px] font-medium text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {dossierSourceFilter === "all" ? "All" : dossierSourceFilter === "freshsales" ? "Freshsales" : "New only"}
          </button>
          <button
            onClick={() => setDossierEmailOnly(v => !v)}
            className={cn(
              "rounded-pill border px-1.5 py-0.5 text-[9px] font-medium transition-colors",
              dossierEmailOnly
                ? "border-accent-secondary/30 text-accent-secondary"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            )}
          >
            Has email
          </button>
          {isFiltered && (
            <span className="text-[8px] text-text-tertiary">
              {displayContacts.length}/{contacts.length}
            </span>
          )}
        </div>
      )}
      {contacts.length === 0 ? (
        <p className="text-xs italic text-text-tertiary">
          {pick("empty_dossier_contacts")}
        </p>
      ) : isFiltered ? (
        <div className="space-y-2">
          {displayContacts.length === 0 ? (
            <p className="text-xs italic text-text-tertiary">
              {pick("empty_contacts_filtered")}
            </p>
          ) : (
            displayContacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                selected={selectedIds.has(contact.id)}
                isFocused={false}
                variant="expanded"
                onToggle={() => toggleContact(contact.id)}
                onDraftEmail={() => setDraftContact(contact)}
                exportInfo={contact.email ? exportByEmail.get(contact.email) : undefined}
              />
            ))
          )}
        </div>
      ) : (() => {
        const newContacts = contacts.filter((c) => !c.sources.includes("freshsales"));
        const knownContacts = contacts.filter((c) => c.sources.includes("freshsales"));
        return (
          <div className="space-y-2">
            {newContacts.length > 0 && (
              <>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-accent-secondary">
                  New Contacts ({newContacts.length})
                </p>
                {newContacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    selected={selectedIds.has(contact.id)}
                    isFocused={false}
                    variant="expanded"
                    onToggle={() => toggleContact(contact.id)}
                    onDraftEmail={() => setDraftContact(contact)}
                    exportInfo={contact.email ? exportByEmail.get(contact.email) : undefined}
                  />
                ))}
              </>
            )}
            {knownContacts.length > 0 && (
              <>
                <p className="mt-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#3EA67B" }}>
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-[#3EA67B]/15 text-[8px] font-bold text-[#3EA67B]">F</span>
                  Known in Freshsales ({knownContacts.length})
                </p>
                {knownContacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    selected={selectedIds.has(contact.id)}
                    isFocused={false}
                    variant="expanded"
                    onToggle={() => toggleContact(contact.id)}
                    onDraftEmail={() => setDraftContact(contact)}
                    exportInfo={contact.email ? exportByEmail.get(contact.email) : undefined}
                  />
                ))}
              </>
            )}
          </div>
        );
      })()}

      {selectedIds.size > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-card border border-surface-3 bg-surface-0 px-3 py-2">
          <span className="text-[10px] font-medium text-text-secondary">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => executeExport(getSelectedContacts(), "clipboard")}
              className="rounded-input bg-accent-primary px-2.5 py-1 text-[10px] font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover"
            >
              Copy
            </button>
            <button
              onClick={() => executeExport(getSelectedContacts(), "csv")}
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

