"use client";

import React, { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { Contact, CompanyEnriched } from "@/lib/navigator/types";
import { SourceBadge } from "@/components/navigator/badges";
import { ConfirmDialog } from "@/components/navigator/shared/ConfirmDialog";
import { useInlineFeedback } from "@/hooks/navigator/useInlineFeedback";
import { useStore } from "@/lib/navigator/store";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import { defaultFreshsalesSettings } from "@/lib/navigator/mock-data";

import { useOutreachSuggestion } from "@/lib/navigator/outreach/useOutreachSuggestion";
import { logEmailCopy } from "@/lib/navigator/logEmailCopy";
import { ContactEmailDisplay } from "./ContactEmailDisplay";
import { ContactCardDetail } from "./ContactCardDetail";

const OutreachDraftModal = lazy(() => import("@/components/navigator/outreach/OutreachDraftModal").then((m) => ({ default: m.OutreachDraftModal })));

function safeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(); } catch { return "\u2014"; }
}

interface ContactCardProps {
  contact: Contact;
  isChecked: boolean;
  onToggleCheck: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isFocused?: boolean;
  company?: CompanyEnriched | null;
  visibleFields?: Set<string>;
}

export function ContactCard({
  contact,
  isChecked,
  onToggleCheck,
  isExpanded,
  onToggleExpand,
  isFocused,
  company,
  visibleFields,
}: ContactCardProps) {
  const queryClient = useQueryClient();
  const { trigger, FeedbackLabel } = useInlineFeedback();
  const selectCompany = useStore((s) => s.selectCompany);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const triggerDossierScrollToTop = useStore((s) => s.triggerDossierScrollToTop);
  const excludeContact = useStore((s) => s.excludeContact);
  const addToast = useStore((s) => s.addToast);

  const [revealLoading, setRevealLoading] = useState(false);
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);
  const [revealFailed, setRevealFailed] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState(false);
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showAddToCrm, setShowAddToCrm] = useState(false);
  const [addToCrmLoading, setAddToCrmLoading] = useState(false);
  const [addedToCrm, setAddedToCrm] = useState(false);
  const rawFreshsalesSettings = useStore((s) => s.adminConfig?.freshsalesSettings);
  const freshsalesSettings = useMemo(
    () => ({ ...defaultFreshsalesSettings, ...rawFreshsalesSettings }),
    [rawFreshsalesSettings]
  );
  const suggestion = useOutreachSuggestion(company, contact, draftModalOpen);

  const handleRevealEmail = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealLoading || revealedEmail) return;
    setRevealConfirm(false);
    setRevealLoading(true);
    setRevealFailed(false);
    try {
      const res = await fetch("/api/contact/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apolloId: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          domain: contact.companyDomain,
        }),
      });
      const data = await res.json();
      if (data.contact?.email) {
        const foundEmail = data.contact.email;
        const foundConfidence = data.contact.emailConfidence ?? 70;
        const foundLevel = data.contact.confidenceLevel ?? "medium";
        setRevealedEmail(foundEmail);
        trigger("Email found");

        // Persist to server cache (fire-and-forget)
        if (contact.companyDomain) {
          fetch("/api/contact/persist-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              domain: contact.companyDomain,
              contactId: contact.id,
              email: foundEmail,
              emailConfidence: foundConfidence,
              confidenceLevel: foundLevel,
            }),
          }).catch(() => {});
        }

        // Update Zustand store
        if (contact.companyDomain) {
          useStore.getState().updateContact(contact.companyDomain, contact.id, {
            ...contact,
            email: foundEmail,
            emailConfidence: foundConfidence,
            confidenceLevel: foundLevel as Contact["confidenceLevel"],
          });
        }

        // Patch TanStack Query cache inline
        queryClient.setQueriesData<Contact[]>(
          { queryKey: ["company-contacts", contact.companyDomain] },
          (old) => old?.map((c) =>
            c.id === contact.id
              ? { ...c, email: foundEmail, emailConfidence: foundConfidence, confidenceLevel: foundLevel as Contact["confidenceLevel"] }
              : c
          ),
        );
      } else {
        setRevealFailed(true);
        trigger("Email not found", "error");
      }
    } catch {
      setRevealFailed(true);
      trigger("Couldn't reveal — try again", "error");
    } finally {
      setRevealLoading(false);
    }
  }, [contact, revealLoading, revealedEmail, trigger, queryClient]);

  const handleRevealClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealLoading || revealedEmail || revealFailed) return;
    // D3: Skip confirm if user preference is set
    if (typeof window !== "undefined" && localStorage.getItem("nav_skip_reveal_confirm") === "1") {
      handleRevealEmail(e);
      return;
    }
    setRevealConfirm(true);
    // Auto-dismiss confirm after 4s
    setTimeout(() => setRevealConfirm(false), 4000);
  }, [revealLoading, revealedEmail, revealFailed, handleRevealEmail]);

  // Use revealed email if available
  const displayEmail = revealedEmail || contact.email;

  const initials =
    (contact.firstName?.[0] ?? "") + (contact.lastName?.[0] ?? "");

  const show = (field: string) => !visibleFields || visibleFields.has(field);

  const handleCopyEmail = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const emailToCopy = revealedEmail || contact.email;
    if (!emailToCopy) return;
    navigator.clipboard.writeText(emailToCopy).then(() => {
      trigger("Copied");
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
      logEmailCopy(emailToCopy, `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(), contact.companyDomain ?? "");
    }).catch(() => {
      trigger("Copy failed", "error");
    });
  }, [contact, revealedEmail, trigger]);

  const handleDraftEmail = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!company) {
      addToast({ message: "Open company dossier first to draft email", type: "info" });
      return;
    }
    setDraftModalOpen(true);
  }, [company, addToast]);

  const handleExclude = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.email) {
      excludeContact(contact.email, "email");
    } else {
      excludeContact(contact.id, "contact_id");
    }
  }, [contact, excludeContact]);

  const handleViewDossier = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contact.companyDomain) {
      addToast({ message: "No company domain available", type: "info" });
      return;
    }
    if (contact.companyDomain === selectedCompanyDomain) {
      // Same company already shown — scroll to top + toast for visible feedback
      triggerDossierScrollToTop();
      addToast({ message: `Viewing ${contact.companyName ?? contact.companyDomain} dossier`, type: "info" });
    } else {
      selectCompany(contact.companyDomain);
    }
  }, [contact, selectedCompanyDomain, triggerDossierScrollToTop, addToast, selectCompany]);

  return (
    <div
      id={`contact-${contact.id}`}
      role="option"
      tabIndex={-1}
      onClick={onToggleExpand}
      className={cn(
        "group cursor-pointer rounded-card border bg-surface-1 transition-all duration-[180ms]",
        isExpanded ? "border-accent-primary/40 shadow-md" : "border-surface-3 hover:shadow-md",
        isFocused && "ring-1 ring-accent-primary/60",
      )}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <label
          className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => { e.stopPropagation(); onToggleCheck(); }}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
        </label>

        {/* Avatar */}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary-light text-[10px] font-semibold text-accent-primary">
          {initials}
        </div>

        {/* Name + title + headline */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {show("name") && (
              <span className="truncate text-sm font-medium text-text-primary" title={`${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()}>
                {contact.firstName ?? ""} {contact.lastName ?? ""}
              </span>
            )}
            {show("title") && (
              <span className="hidden truncate text-xs text-text-secondary sm:inline" title={contact.title ?? undefined}>
                {contact.title ?? ""}
              </span>
            )}
            {contact.linkedinUrl && (
              <Tooltip text="LinkedIn profile">
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 text-text-tertiary transition-colors hover:text-accent-secondary"
                >
                  <LinkedInIcon />
                </a>
              </Tooltip>
            )}
          </div>
          {contact.headline && (
            <p className="truncate text-xs text-text-tertiary" title={contact.headline}>{contact.headline}</p>
          )}
        </div>

        {/* Email (hero element — state-based display) */}
        {show("email") && (
          <div className="flex items-center gap-1.5">
            <ContactEmailDisplay
              contact={contact}
              displayEmail={displayEmail}
              revealConfirm={revealConfirm}
              revealLoading={revealLoading}
              revealFailed={revealFailed}
              copySuccess={copySuccess}
              onRevealEmail={handleRevealEmail}
              onRevealClick={handleRevealClick}
              onCopyEmail={handleCopyEmail}
            />
          </div>
        )}

        {/* CRM status pill */}
        {contact.crmStatus && (
          <span className="rounded-pill border border-accent-secondary/30 bg-accent-secondary/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-secondary">
            {contact.crmStatus}
          </span>
        )}

        {/* Contact tags */}
        {contact.tags && contact.tags.length > 0 && (
          <div className="flex gap-0.5">
            {contact.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-pill bg-surface-2 px-1 py-0.5 text-[8px] text-text-tertiary">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Source badges */}
        {show("sources") && (
          <div className="flex gap-0.5">
            {(Array.isArray(contact.sources) ? contact.sources : []).map((src) => (
              <SourceBadge key={src} source={src} />
            ))}
          </div>
        )}

        {/* Last contacted */}
        {show("lastContacted") && contact.lastVerified && (
          <span className="text-[10px] text-text-tertiary">
            {safeDate(contact.lastVerified)}
          </span>
        )}

        {/* Expand chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "flex-shrink-0 text-text-tertiary transition-transform duration-[180ms]",
            isExpanded && "rotate-180"
          )}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Add to CRM confirm dialog */}
      <ConfirmDialog
        open={showAddToCrm}
        title="Add to Freshsales"
        message={`Create ${contact.firstName} ${contact.lastName}${contact.title ? ` (${contact.title})` : ""} as a contact under ${contact.companyName} in Freshsales?`}
        confirmLabel="Add to CRM"
        cancelLabel="Cancel"
        onConfirm={async () => {
          setShowAddToCrm(false);
          setAddToCrmLoading(true);
          try {
            const res = await fetch("/api/freshsales/contacts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                firstName: contact.firstName,
                lastName: contact.lastName,
                email: contact.email,
                phone: contact.phone,
                title: contact.title,
                linkedinUrl: contact.linkedinUrl,
                companyDomain: contact.companyDomain,
                companyName: contact.companyName,
              }),
            });
            if (res.ok) {
              setAddedToCrm(true);
              addToast({ message: `${contact.firstName} added to Freshsales`, type: "success" });
            } else {
              addToast({ message: "Failed to add contact to CRM", type: "error" });
            }
          } catch {
            addToast({ message: "Failed to add contact to CRM", type: "error" });
          } finally {
            setAddToCrmLoading(false);
          }
        }}
        onCancel={() => setShowAddToCrm(false)}
      />

      {/* Draft email modal */}
      {draftModalOpen && company && (
        <Suspense fallback={null}>
          <OutreachDraftModal
            contact={contact}
            company={company}
            onClose={() => setDraftModalOpen(false)}
            suggestedChannel={suggestion?.channel}
            suggestedTemplate={suggestion?.template as import("@/lib/navigator/types").EmailTemplate | undefined}
            suggestedTone={suggestion?.tone}
            suggestionReason={suggestion?.reason}
          />
        </Suspense>
      )}

      {/* Expanded detail */}
      {isExpanded && (
        <ContactCardDetail
          contact={contact}
          company={company}
          displayEmail={displayEmail}
          revealConfirm={revealConfirm}
          revealLoading={revealLoading}
          revealFailed={revealFailed}
          addedToCrm={addedToCrm}
          addToCrmLoading={addToCrmLoading}
          freshsalesEnablePushContact={freshsalesSettings.enablePushContact}
          copySuccess={copySuccess}
          show={show}
          onRevealEmail={handleRevealEmail}
          onRevealClick={handleRevealClick}
          onCopyEmail={handleCopyEmail}
          onViewDossier={handleViewDossier}
          onDraftEmail={handleDraftEmail}
          onExclude={handleExclude}
          onShowAddToCrm={() => setShowAddToCrm(true)}
          FeedbackLabel={FeedbackLabel}
        />
      )}
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
