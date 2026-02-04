"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  const suggestion = useOutreachSuggestion(company, draftContact, !!draftContact);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const allSelected = contacts.length > 0 && contacts.every((c) => selectedContactIds.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      // Deselect only this company's contacts
      for (const c of contacts) {
        if (selectedContactIds.has(c.id)) {
          toggleContactSelection(c.id);
        }
      }
    } else {
      for (const c of contacts) {
        if (!selectedContactIds.has(c.id)) {
          toggleContactSelection(c.id);
        }
      }
    }
  };

  const handleBackToDossier = () => {
    setSlideOverMode("dossier");
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (contacts.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, contacts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    } else if ((e.key === " " || e.key === "Enter") && focusIndex >= 0) {
      e.preventDefault();
      toggleContactSelection(contacts[focusIndex].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleBackToDossier();
    } else if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleAll();
    }
  };

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

      {/* Select All */}
      {contacts.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-2 px-4 py-2">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3 w-3 rounded accent-accent-primary"
            />
            <span className="text-[10px] font-medium text-text-tertiary">
              Select All ({contacts.length})
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
        ) : (
          contacts.map((contact, i) => (
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
