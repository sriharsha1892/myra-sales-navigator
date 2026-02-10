"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { ContactRow } from "./ContactRow";
import { OutreachDraftModal } from "@/components/navigator/outreach/OutreachDraftModal";
import { useOutreachSuggestion } from "@/lib/navigator/outreach/useOutreachSuggestion";
import { cn } from "@/lib/cn";
import type { Contact, CompanyEnriched } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";

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

const SENIORITY_ORDER: Record<string, number> = {
  c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
};

export function ContactsPanel({ domain, company, contacts }: ContactsPanelProps) {
  const setSlideOverMode = useStore((s) => s.setSlideOverMode);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);

  const [focusIndex, setFocusIndex] = useState(-1);
  const [expandedIndex, setExpandedIndex] = useState(-1);
  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [seniorityFilter, setSeniorityFilter] = useState<string>("all");
  const [hasEmailFilter, setHasEmailFilter] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "freshsales">("all");
  const [verifiedFilter, setVerifiedFilter] = useState(false);
  const [sortBy, setSortBy] = useState<"seniority" | "email_confidence" | "last_contacted">("seniority");
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
    if (sourceFilter === "freshsales") {
      result = result.filter((c) => c.sources.includes("freshsales"));
    }
    if (verifiedFilter) {
      result = result.filter((c) => c.verificationStatus === "valid" || c.verificationStatus === "valid_risky");
    }
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "email_confidence") return (b.emailConfidence ?? 0) - (a.emailConfidence ?? 0);
      if (sortBy === "last_contacted") {
        const aDate = a.lastVerified ? new Date(a.lastVerified).getTime() : 0;
        const bDate = b.lastVerified ? new Date(b.lastVerified).getTime() : 0;
        return bDate - aDate;
      }
      // Default: seniority
      return (SENIORITY_ORDER[a.seniority] ?? 5) - (SENIORITY_ORDER[b.seniority] ?? 5);
    });
    return result;
  }, [contacts, seniorityFilter, hasEmailFilter, sourceFilter, verifiedFilter, sortBy]);

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

  const hasSelection = selectedContactIds.size > 0 &&
    filteredContacts.some((c) => selectedContactIds.has(c.id));

  const deselectAll = useCallback(() => {
    for (const c of filteredContacts) {
      if (selectedContactIds.has(c.id)) {
        toggleContactSelection(c.id);
      }
    }
  }, [filteredContacts, selectedContactIds, toggleContactSelection]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filteredContacts.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, filteredContacts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === " " && focusIndex >= 0) {
      // Space: toggle checkbox
      e.preventDefault();
      toggleContactSelection(filteredContacts[focusIndex].id);
    } else if (e.key === "Enter" && focusIndex >= 0) {
      // Enter: expand/collapse focused contact's detail section
      e.preventDefault();
      setExpandedIndex((prev) => (prev === focusIndex ? -1 : focusIndex));
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (hasSelection) {
        // First escape: clear selection
        deselectAll();
      } else {
        // Second escape (or no selection): go back to dossier
        handleBackToDossier();
      }
    } else if (e.key === "a" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      // Cmd+Shift+A: deselect all
      e.preventDefault();
      deselectAll();
    } else if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
      // Cmd+A: select all
      e.preventDefault();
      toggleAll();
    }
  }, [filteredContacts, focusIndex, toggleContactSelection, handleBackToDossier, toggleAll, hasSelection, deselectAll]);

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
            onChange={(e) => { setSeniorityFilter(e.target.value); setFocusIndex(-1); setExpandedIndex(-1); }}
            className="rounded-input border border-surface-3 bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
          >
            <option value="all">All levels</option>
            <option value="c_level">C-Level</option>
            <option value="vp">VP</option>
            <option value="director">Director</option>
            <option value="manager">Manager</option>
          </select>
          <button
            onClick={() => { setHasEmailFilter((v) => !v); setFocusIndex(-1); setExpandedIndex(-1); }}
            className={`rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              hasEmailFilter
                ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Has email
          </button>
          {/* Source filter */}
          <button
            onClick={() => { setSourceFilter(v => v === "freshsales" ? "all" : "freshsales"); setFocusIndex(-1); setExpandedIndex(-1); }}
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors",
              sourceFilter === "freshsales"
                ? "border-[#3EA67B]/30 bg-[#3EA67B]/10 text-[#3EA67B]"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            )}
          >
            In Freshsales
          </button>
          {/* Verified filter */}
          <button
            onClick={() => { setVerifiedFilter(v => !v); setFocusIndex(-1); setExpandedIndex(-1); }}
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors",
              verifiedFilter
                ? "border-success/30 bg-success/10 text-success"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            )}
          >
            Verified
          </button>
          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as "seniority" | "email_confidence" | "last_contacted"); setFocusIndex(-1); setExpandedIndex(-1); }}
            className="rounded-input border border-surface-3 bg-surface-1 px-1.5 py-0.5 text-[10px] text-text-secondary outline-none"
          >
            <option value="seniority">Sort: Seniority</option>
            <option value="email_confidence">Sort: Confidence</option>
            <option value="last_contacted">Sort: Last verified</option>
          </select>
          {(seniorityFilter !== "all" || hasEmailFilter || sourceFilter !== "all" || verifiedFilter) && (
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
      <div
        ref={containerRef}
        tabIndex={0}
        role="listbox"
        aria-label="Contacts list"
        aria-activedescendant={focusIndex >= 0 ? `contact-item-${focusIndex}` : undefined}
        className="flex-1 space-y-1.5 overflow-y-auto px-4 py-2 focus:outline-none"
      >
        {contacts.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-text-tertiary">
            {pick("empty_contacts_panel")}
          </p>
        ) : filteredContacts.length === 0 ? (
          <p className="py-8 text-center text-xs italic text-text-tertiary">
            {pick("empty_contacts_filtered")}
          </p>
        ) : (
          filteredContacts.map((contact, i) => (
            <div
              key={contact.id}
              id={`contact-item-${i}`}
              data-contact-index={i}
              className={cn(
                "rounded-card transition-all duration-[180ms]",
                focusIndex === i && "ring-1 ring-accent-secondary/40"
              )}
            >
              <ContactRow
                contact={contact}
                selected={selectedContactIds.has(contact.id)}
                isFocused={focusIndex === i}
                variant={expandedIndex === i ? "expanded" : "compact"}
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
