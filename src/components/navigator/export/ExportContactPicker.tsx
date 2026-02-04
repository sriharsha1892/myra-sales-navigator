"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Overlay } from "@/components/primitives/Overlay";
import { ConfidenceBadge } from "@/components/navigator/badges";
import { useStore } from "@/lib/navigator/store";
import { pick } from "@/lib/navigator/ui-copy";
import { ExportStepIndicator } from "./ExportStepIndicator";

interface ExportContactPickerProps {
  contactIds: string[];
  mode: "csv" | "clipboard" | "excel";
  onExport: (contactIds: string[]) => void;
  onCancel: () => void;
}

export function ExportContactPicker({ contactIds, mode, onExport, onCancel }: ExportContactPickerProps) {
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const companies = useStore((s) => s.companies);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const [selected, setSelected] = useState<Set<string>>(new Set(contactIds));
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const queryClient = useQueryClient();

  // Fetch contacts for all selected companies on modal open, populate Zustand
  useEffect(() => {
    let cancelled = false;
    const domainsToFetch = [...selectedCompanyDomains].filter(
      (d) => !useStore.getState().contactsByDomain[d]
    );

    if (domainsToFetch.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(
      domainsToFetch.map((domain) =>
        queryClient.fetchQuery({
          queryKey: ["company-contacts", domain],
          queryFn: async () => {
            const res = await fetch(`/api/company/${encodeURIComponent(domain)}/contacts`);
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            return data.contacts ?? [];
          },
          staleTime: 5 * 60 * 1000,
        }).then((contacts) => {
          if (!cancelled) {
            useStore.getState().setContactsForDomain(domain, contacts);
          }
        }).catch(() => { if (!cancelled) setFetchError(true); })
      )
    ).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedCompanyDomains, queryClient]);

  const allContacts = Object.values(contactsByDomain).flat();
  const relevantContacts = allContacts.filter((c) => contactIds.includes(c.id));

  // Group by company
  const grouped = new Map<string, typeof relevantContacts>();
  for (const contact of relevantContacts) {
    const existing = grouped.get(contact.companyDomain) ?? [];
    existing.push(contact);
    grouped.set(contact.companyDomain, existing);
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === relevantContacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(relevantContacts.map((c) => c.id)));
    }
  };

  return (
    <Overlay open={true} onClose={onCancel} backdrop="blur" placement="center">
      <div className="w-full max-w-md rounded-card border border-surface-3 bg-surface-1 shadow-2xl">
        <div className="border-b border-surface-3">
          <ExportStepIndicator step={1} />
        </div>
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <h3 className="font-display text-sm font-medium text-text-primary">
            Select Contacts to {mode === "csv" ? "Export" : "Copy"}
          </h3>
          <button onClick={onCancel} className="text-text-tertiary hover:text-text-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-surface-3 border-t-accent-primary" />
              <span className="ml-2 text-xs text-text-tertiary">Loading contacts...</span>
            </div>
          ) : (
          <>
          {fetchError && (
            <div className="mb-2 flex items-center gap-2 rounded-card border border-danger/20 bg-danger-light px-3 py-2 text-xs text-danger">
              <span className="flex-1">{pick("contacts_fetch_failed")}</span>
              <button
                onClick={() => {
                  setFetchError(false);
                  setLoading(true);
                  const domainsToRetry = [...selectedCompanyDomains].filter(
                    (d) => !useStore.getState().contactsByDomain[d]
                  );
                  Promise.all(
                    domainsToRetry.map((domain) =>
                      queryClient.fetchQuery({
                        queryKey: ["company-contacts", domain],
                        queryFn: async () => {
                          const res = await fetch(`/api/company/${encodeURIComponent(domain)}/contacts`);
                          if (!res.ok) throw new Error("Failed");
                          const data = await res.json();
                          return data.contacts ?? [];
                        },
                        staleTime: 5 * 60 * 1000,
                      }).then((contacts) => {
                        useStore.getState().setContactsForDomain(domain, contacts);
                      }).catch(() => setFetchError(true))
                    )
                  ).finally(() => setLoading(false));
                }}
                className="font-medium underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.size === relevantContacts.length}
              onChange={toggleAll}
              className="h-3.5 w-3.5 rounded accent-accent-primary"
            />
            <span className="text-xs text-text-secondary">
              Select all ({relevantContacts.length})
            </span>
          </div>

          {Array.from(grouped.entries()).map(([domain, contacts]) => {
            const company = companies.find((c) => c.domain === domain);
            return (
              <div key={domain} className="mb-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {company?.name ?? domain}
                </p>
                <div className="space-y-0.5">
                  {contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-surface-hover"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(contact.id)}
                        onChange={() => toggle(contact.id)}
                        className="h-3 w-3 rounded accent-accent-primary"
                      />
                      <span className="text-xs text-text-primary">
                        {contact.firstName} {contact.lastName}
                      </span>
                      {contact.email ? (
                        <span className="ml-auto flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-text-tertiary">
                            {contact.email}
                          </span>
                          <ConfidenceBadge level={contact.confidenceLevel} score={contact.emailConfidence} />
                        </span>
                      ) : (
                        <span className="ml-auto text-[10px] italic text-text-tertiary">No email found</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          </>
          )}
        </div>

        <div className="border-t border-surface-3 px-5 py-3">
          {(() => {
            const noEmailCount = relevantContacts.filter((c) => selected.has(c.id) && !c.email).length;
            if (noEmailCount > 0) {
              return (
                <div className="mb-2 rounded-input border border-warning/20 bg-warning-light px-2.5 py-1.5 text-[10px] text-warning">
                  {pick("export_no_email_skip", { count: String(noEmailCount) })}
                </div>
              );
            }
            return null;
          })()}
          <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            {selected.size} selected
            {(() => {
              const withEmail = relevantContacts.filter((c) => selected.has(c.id) && c.email).length;
              return withEmail < selected.size ? ` (${withEmail} with email)` : "";
            })()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded-input px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              onClick={() => onExport(Array.from(selected))}
              disabled={selected.size === 0}
              className="rounded-input bg-accent-primary px-4 py-1.5 text-xs font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-40"
            >
              {mode === "csv" ? "Export" : "Copy"} {selected.size} contacts
            </button>
          </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
