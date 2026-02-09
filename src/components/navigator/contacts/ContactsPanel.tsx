"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { ContactRow } from "./ContactRow";
import { OutreachDraftModal } from "@/components/navigator/outreach/OutreachDraftModal";
import { useOutreachSuggestion } from "@/lib/navigator/outreach/useOutreachSuggestion";
import type { Contact, CompanyEnriched } from "@/lib/navigator/types";

interface ContactsPanelProps {
  domain: string;
  company: CompanyEnriched;
  contacts: Contact[];
}

const freshsalesLabels: Record<string, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  customer: "Customer",
  none: "",
};

export function ContactsPanel({ domain, company, contacts }: ContactsPanelProps) {
  const setSlideOverMode = useStore((s) => s.setSlideOverMode);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);

  const [focusIndex, setFocusIndex] = useState(-1);
  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [seniorityFilter, setSeniorityFilter] = useState<string>("all");
  const [hasEmailFilter, setHasEmailFilter] = useState(false);
  const suggestion = useOutreachSuggestion(company, draftContact, !!draftContact);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter contacts based on local filter state
  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (seniorityFilter !== "all") {
      result = result.filter((c) => c.seniority === seniorityFilter);
    }
    if (hasEmailFilter) {
      result = result.filter((c) => !!c.email);
    }
    return result;
  }, [contacts, seniorityFilter, hasEmailFilter]);

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

  const allSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selectedContactIds.has(c.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      // Deselect only this company's filtered contacts
      for (const c of filteredContacts) {
        if (selectedContactIds.has(c.id)) {
          toggleContactSelection(c.id);
        }
      }
    } else {
      for (const c of filteredContacts) {
        if (!selectedContactIds.has(c.id)) {
          toggleContactSelection(c.id);
        }
      }
    }
  }, [allSelected, filteredContacts, selectedContactIds, toggleContactSelection]);

  const handleBackToDossier = useCallback(() => {
    setSlideOverMode("dossier");
  }, [setSlideOverMode]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filteredContacts.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, filteredContacts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    } else if ((e.key === " " || e.key === "Enter") && focusIndex >= 0) {
      e.preventDefault();
      toggleContactSelection(filteredContacts[focusIndex].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleBackToDossier();
    } else if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleAll();
    }
  }, [filteredContacts, focusIndex, toggleContactSelection, handleBackToDossier, toggleAll]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusIndex >= 0 && containerRef.current) {
      const row = containerRef.current.querySelector(`[data-contact-index="${focusIndex}"]`);
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusIndex]);

  const fsStatus = company.freshsalesStatus !== "none"
    ? freshsalesLabels[company.freshsalesStatus] ?? company.freshsalesStatus
    : null;

  return (
    <>
      {/* Company summary */}
      <div className="flex-shrink-0 border-b border-surface-3 px-4 py-3">
        <h2 className="font-display text-base font-semibold text-text-primary">
          {company.name}
        </h2>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-mono">{domain}</span>
          {fsStatus && (
            <>
              <span className="text-text-tertiary">&middot;</span>
              <span
                className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "rgba(62, 166, 123, 0.12)", color: "#3EA67B" }}
              >
                CRM: {fsStatus}
              </span>
            </>
          )}
          <span className="text-text-tertiary">&middot;</span>
          <span>{contacts.length} contacts</span>
        </div>
      </div>

      {/* Filter bar */}
      {contacts.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-surface-3 px-4 py-2">
          <select
            value={seniorityFilter}
            onChange={(e) => { setSeniorityFilter(e.target.value); setFocusIndex(-1); }}
            className="rounded-input border border-surface-3 bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
          >
            <option value="all">All levels</option>
            <option value="c_level">C-Level</option>
            <option value="vp">VP</option>
            <option value="director">Director</option>
            <option value="manager">Manager</option>
          </select>
          <button
            onClick={() => { setHasEmailFilter((v) => !v); setFocusIndex(-1); }}
            className={`rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              hasEmailFilter
                ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Has email
          </button>
          {(seniorityFilter !== "all" || hasEmailFilter) && (
            <span className="text-[10px] text-text-tertiary">
              {filteredContacts.length}/{contacts.length}
            </span>
          )}
        </div>
      )}

      {/* Select All */}
      {filteredContacts.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-2 px-4 py-2">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3 w-3 rounded accent-accent-primary"
            />
            <span className="text-[10px] font-medium text-text-tertiary">
              Select All ({filteredContacts.length})
            </span>
          </label>
        </div>
      )}

      {/* Contact list */}
      <div ref={containerRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-2">
        {contacts.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-text-tertiary">
            No contacts found for this company.
          </p>
        ) : filteredContacts.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-text-tertiary">
            No contacts match the current filters.
          </p>
        ) : (
          filteredContacts.map((contact, i) => (
            <div key={contact.id} data-contact-index={i}>
              <ContactRow
                contact={contact}
                selected={selectedContactIds.has(contact.id)}
                isFocused={focusIndex === i}
                variant={focusIndex === i ? "expanded" : "compact"}
                onToggle={() => toggleContactSelection(contact.id)}
                onDraftEmail={() => setDraftContact(contact)}
                exportInfo={contact.email ? exportByEmail.get(contact.email) : undefined}
              />
            </div>
          ))
        )}
      </div>

      {draftContact && (
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
    </>
  );
}
