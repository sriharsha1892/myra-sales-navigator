"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/navigator/store";
import { ContactCard } from "./ContactCard";
import type { Contact } from "@/lib/navigator/types";

const SENIORITY_ORDER: Record<string, number> = {
  c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
};

interface InlineContactsProps {
  domain: string;
  companyName?: string;
}

export function InlineContacts({ domain, companyName }: InlineContactsProps) {
  const contacts = useStore((s) => s.contactsByDomain[domain]);
  const setContactsForDomain = useStore((s) => s.setContactsForDomain);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const toggleContactSelection = useStore((s) => s.toggleContactSelection);

  const [loading, setLoading] = useState(() => !contacts);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);

  useEffect(() => {
    if (contacts) return; // already cached in store

    const nameParam = companyName && companyName !== domain ? `?name=${encodeURIComponent(companyName)}` : "";
    fetch(`/api/company/${encodeURIComponent(domain)}/contacts${nameParam}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setContactsForDomain(domain, data.contacts ?? []);
      })
      .catch((err) => {
        setError(err.message || "Failed to load contacts");
      })
      .finally(() => setLoading(false));
  }, [domain, companyName, contacts, setContactsForDomain]);

  // Loading shimmer
  if (loading) {
    return (
      <div className="ml-8 mt-1 mb-2 space-y-1 border-l-2 border-surface-3 pl-3 animate-fadeInUp">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card border border-surface-3 bg-surface-1 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="shimmer h-3 w-3 rounded" />
              <div className="shimmer h-3 w-24 rounded" />
              <div className="shimmer ml-auto h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="ml-8 mt-1 mb-2 border-l-2 border-danger/30 pl-3">
        <p className="text-xs text-danger">Failed to load contacts: {error}</p>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="ml-8 mt-1 mb-2 border-l-2 border-surface-3 pl-3">
        <p className="text-xs text-text-tertiary italic">No contacts found</p>
      </div>
    );
  }

  // Sort by seniority, then by email confidence
  const sorted = [...contacts].sort((a, b) => {
    const sa = SENIORITY_ORDER[a.seniority] ?? 5;
    const sb = SENIORITY_ORDER[b.seniority] ?? 5;
    if (sa !== sb) return sa - sb;
    return b.emailConfidence - a.emailConfidence;
  });

  const visible = showAll ? sorted : sorted.slice(0, 5);
  const hiddenCount = sorted.length - 5;

  return (
    <div className="ml-8 mt-1 mb-2 space-y-1 border-l-2 border-accent-secondary/30 pl-3 animate-fadeInUp">
      {visible.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          isChecked={selectedContactIds.has(contact.id)}
          onToggleCheck={() => toggleContactSelection(contact.id)}
          isExpanded={expandedContactId === contact.id}
          onToggleExpand={() =>
            setExpandedContactId(expandedContactId === contact.id ? null : contact.id)
          }
        />
      ))}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
          className="px-2 py-1 text-xs text-accent-secondary hover:underline"
        >
          Show all {sorted.length} contacts
        </button>
      )}
      {showAll && hiddenCount > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
          className="px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
