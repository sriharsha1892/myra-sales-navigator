"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ConfidenceBadge, SourceBadge } from "@/components/badges";
import { MissingData } from "@/components/shared/MissingData";
import { EmailDraftModal } from "@/components/email/EmailDraftModal";
import { useInlineFeedback } from "@/hooks/useInlineFeedback";
import { useExport } from "@/hooks/useExport";
import type { Contact, ResultSource } from "@/lib/types";

interface DossierContactsProps {
  companyDomain: string;
  contacts?: Contact[];
}

export function DossierContacts({ companyDomain, contacts: contactsProp }: DossierContactsProps) {
  const companyContacts = useStore((s) => s.companyContacts);
  const selectedCompany = useStore((s) => s.selectedCompany);
  const updateContact = useStore((s) => s.updateContact);
  const contacts = contactsProp ?? companyContacts(companyDomain);
  const company = selectedCompany();

  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [findingEmails, setFindingEmails] = useState(false);

  const { executeExport } = useExport();

  const MIN_CONFIDENCE = 70;
  const missingEmailContacts = contacts.filter(
    (c) => !c.email || c.emailConfidence < MIN_CONFIDENCE
  );

  const handleFindEmails = useCallback(async () => {
    if (missingEmailContacts.length === 0 || findingEmails) return;
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
      if (!res.ok) throw new Error("Email finder failed");
      const data = await res.json();
      for (const r of data.results ?? []) {
        if (r.email && r.status === "found") {
          const existing = contacts.find((c) => c.id === r.contactId);
          if (existing) {
            const newSources: ResultSource[] = existing.sources.includes("clearout")
              ? existing.sources
              : [...existing.sources, "clearout"];
            updateContact(companyDomain, r.contactId, {
              ...existing,
              email: r.email,
              emailConfidence: r.confidence,
              confidenceLevel: r.confidence >= 90 ? "high" : r.confidence >= 70 ? "medium" : "low",
              sources: newSources,
            });
          }
        }
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setFindingEmails(false);
    }
  }, [companyDomain, contacts, missingEmailContacts, findingEmails, updateContact]);

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

  return (
    <div className="rounded-card bg-surface-0/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Contacts ({contacts.length})
        </h3>
        <div className="flex items-center gap-2">
          {missingEmailContacts.length > 0 && (
            <button
              onClick={handleFindEmails}
              disabled={findingEmails}
              className="flex items-center gap-1 rounded-pill bg-accent-primary px-2.5 py-1 text-[10px] font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
            >
              {findingEmails && (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
                </svg>
              )}
              {findingEmails ? "Finding\u2026" : `Find ${missingEmailContacts.length} missing emails`}
            </button>
          )}
          {contacts.length > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={selectedIds.size === contacts.length && contacts.length > 0}
                onChange={toggleAll}
                className="h-3 w-3 rounded accent-accent-primary"
              />
              <span className="text-[10px] text-text-tertiary">All</span>
            </label>
          )}
        </div>
      </div>
      {contacts.length === 0 ? (
        <p className="text-xs italic text-text-tertiary">
          No contacts yet for this company. Try searching for it directly, or check back later as data sources update.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <DossierContactRow
              key={contact.id}
              contact={contact}
              selected={selectedIds.has(contact.id)}
              anySelected={selectedIds.size > 0}
              onToggle={() => toggleContact(contact.id)}
              onDraftEmail={() => setDraftContact(contact)}
            />
          ))}
        </div>
      )}

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
        <EmailDraftModal
          contact={draftContact}
          company={company}
          onClose={() => setDraftContact(null)}
        />
      )}
    </div>
  );
}

function isObfuscated(name: string): boolean {
  return name.includes("***");
}

function DossierContactRow({
  contact,
  selected,
  anySelected,
  onToggle,
  onDraftEmail,
}: {
  contact: Contact;
  selected: boolean;
  anySelected: boolean;
  onToggle: () => void;
  onDraftEmail: () => void;
}) {
  const { trigger, FeedbackLabel } = useInlineFeedback();
  const updateContact = useStore((s) => s.updateContact);
  const [revealing, setRevealing] = useState(false);

  const needsReveal =
    isObfuscated(contact.lastName) || (!contact.email && !contact.phone);

  const handleReveal = useCallback(async () => {
    setRevealing(true);
    try {
      const res = await fetch("/api/contact/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apolloId: contact.id }),
      });
      if (!res.ok) throw new Error("Enrichment failed");
      const data = await res.json();
      if (data.contact) {
        updateContact(contact.companyDomain, contact.id, {
          ...contact,
          ...data.contact,
          id: contact.id,
          companyDomain: contact.companyDomain,
          sources: contact.sources,
        });
      }
    } catch {
      trigger("Reveal failed", "error");
    } finally {
      setRevealing(false);
    }
  }, [contact, updateContact, trigger]);

  const handleCopy = (email: string) => {
    navigator.clipboard
      .writeText(email)
      .then(() => {
        trigger("Copied");
      })
      .catch(() => {
        trigger("Failed", "error");
      });
  };

  return (
    <div className="group rounded-card border border-surface-3 bg-surface-0 p-2.5">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className={cn(
            "h-3 w-3 flex-shrink-0 rounded accent-accent-primary transition-opacity",
            anySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        />
        <span className="text-xs font-medium text-text-primary">
          {contact.firstName} {contact.lastName}
        </span>
        <div className="flex gap-0.5">
          {(Array.isArray(contact.sources) ? contact.sources : []).map((src) => (
            <SourceBadge key={src} source={src} />
          ))}
        </div>
        {needsReveal && (
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-50"
          >
            {revealing ? "Revealing\u2026" : "Reveal"}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-text-secondary">{contact.title}</p>
      <div className="mt-1 flex items-center gap-2">
        {contact.email ? (
          <>
            <span className="font-mono text-xs text-text-secondary">
              {contact.email}
            </span>
            <ConfidenceBadge
              level={contact.confidenceLevel}
              score={contact.emailConfidence}
            />
            <button
              onClick={() => handleCopy(contact.email!)}
              className="text-text-tertiary opacity-50 transition-opacity hover:text-accent-primary group-hover:opacity-100"
              title="Copy email"
              aria-label="Copy email"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            {FeedbackLabel}
          </>
        ) : (
          <MissingData label="No email found" />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between">
        {contact.phone ? (
          <p className="font-mono text-[10px] text-text-tertiary">
            {contact.phone}
          </p>
        ) : (
          <MissingData label="No phone available" />
        )}
        {contact.email && (
          <button
            onClick={onDraftEmail}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-accent-primary opacity-50 transition-all hover:bg-accent-primary-light group-hover:opacity-100"
          >
            Draft Email
          </button>
        )}
      </div>
    </div>
  );
}
