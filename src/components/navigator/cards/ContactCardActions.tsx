"use client";

import React from "react";
import type { Contact, CompanyEnriched } from "@/lib/navigator/types";

interface ContactCardActionsProps {
  contact: Contact;
  displayEmail: string | null;
  revealConfirm: boolean;
  revealLoading: boolean;
  revealFailed: boolean;
  addedToCrm: boolean;
  freshsalesEnablePushContact: boolean;
  company?: CompanyEnriched | null;
  onRevealEmail: (e: React.MouseEvent) => void;
  onRevealClick: (e: React.MouseEvent) => void;
  onCopyEmail: (e: React.MouseEvent) => void;
  onViewDossier: (e: React.MouseEvent) => void;
  onDraftEmail: (e: React.MouseEvent) => void;
  onExclude: (e: React.MouseEvent) => void;
  onShowAddToCrm: () => void;
  FeedbackLabel: React.ReactNode;
}

export const ContactCardActions = React.memo(function ContactCardActions({
  contact,
  displayEmail,
  revealConfirm,
  revealLoading,
  revealFailed,
  addedToCrm,
  freshsalesEnablePushContact,
  company,
  onRevealEmail,
  onRevealClick,
  onCopyEmail,
  onViewDossier,
  onDraftEmail,
  onExclude,
  onShowAddToCrm,
  FeedbackLabel,
}: ContactCardActionsProps) {
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-surface-3 pt-2.5">
      {displayEmail ? (
        <button
          onClick={onCopyEmail}
          className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-2"
        >
          Copy email
        </button>
      ) : revealConfirm ? (
        <button
          onClick={onRevealEmail}
          className="rounded-input border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
        >
          Uses 1 credit — Confirm
        </button>
      ) : (
        <button
          onClick={onRevealClick}
          disabled={revealLoading || revealFailed}
          className="rounded-input border border-accent-secondary/30 bg-accent-secondary/5 px-2.5 py-1 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {revealLoading ? "Revealing..." : revealFailed ? "Not found" : "Reveal email"}
        </button>
      )}
      {FeedbackLabel}
      <button
        onClick={onViewDossier}
        className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-2"
      >
        View dossier
      </button>
      <button
        onClick={onDraftEmail}
        className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-2"
      >
        Draft email
      </button>
      {/* Add to CRM */}
      {!addedToCrm && !contact.sources.includes("freshsales") && company?.freshsalesAvailable && contact.email && freshsalesEnablePushContact && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowAddToCrm(); }}
          className="rounded-input border border-accent-secondary/30 bg-accent-secondary/5 px-2.5 py-1 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/10"
        >
          Add to CRM
        </button>
      )}
      {addedToCrm && (
        <span className="rounded-input border border-success/30 bg-success/5 px-2.5 py-1 text-[10px] font-medium text-success">
          In CRM
        </span>
      )}
      <button
        onClick={onExclude}
        className="ml-auto rounded-input border border-danger/30 px-2.5 py-1 text-[10px] font-medium text-danger/70 transition-colors hover:bg-danger/10"
      >
        Exclude
      </button>
    </div>
  );
});
