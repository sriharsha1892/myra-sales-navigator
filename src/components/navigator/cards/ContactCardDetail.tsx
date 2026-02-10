"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Contact, CompanyEnriched } from "@/lib/navigator/types";
import { SourceBadge, VerificationBadge, IcpScoreBadge } from "@/components/navigator/badges";
import { MissingData } from "@/components/navigator/shared/MissingData";
import { ContactCardActions } from "./ContactCardActions";

function safeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(); } catch { return "\u2014"; }
}

interface ContactCardDetailProps {
  contact: Contact;
  company?: CompanyEnriched | null;
  displayEmail: string | null;
  revealConfirm: boolean;
  revealLoading: boolean;
  revealFailed: boolean;
  addedToCrm: boolean;
  addToCrmLoading: boolean;
  freshsalesEnablePushContact: boolean;
  copySuccess: boolean;
  show: (field: string) => boolean;
  onRevealEmail: (e: React.MouseEvent) => void;
  onRevealClick: (e: React.MouseEvent) => void;
  onCopyEmail: (e: React.MouseEvent) => void;
  onViewDossier: (e: React.MouseEvent) => void;
  onDraftEmail: (e: React.MouseEvent) => void;
  onExclude: (e: React.MouseEvent) => void;
  onShowAddToCrm: () => void;
  FeedbackLabel: React.ReactNode;
}

const seniorityLabel: Record<string, string> = {
  c_level: "C-Level",
  vp: "VP",
  director: "Director",
  manager: "Manager",
  staff: "Staff",
};

export const ContactCardDetail = React.memo(function ContactCardDetail({
  contact,
  company,
  displayEmail,
  revealConfirm,
  revealLoading,
  revealFailed,
  addedToCrm,
  freshsalesEnablePushContact,
  show,
  onRevealEmail,
  onRevealClick,
  onCopyEmail,
  onViewDossier,
  onDraftEmail,
  onExclude,
  onShowAddToCrm,
  FeedbackLabel,
}: ContactCardDetailProps) {
  const chipRef = useRef<HTMLSpanElement>(null);
  const popoverTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handlePopoverEnter = () => {
    clearTimeout(popoverTimerRef.current);
    popoverTimerRef.current = setTimeout(() => setPopoverOpen(true), 200);
  };

  const handlePopoverLeave = () => {
    clearTimeout(popoverTimerRef.current);
    popoverTimerRef.current = setTimeout(() => setPopoverOpen(false), 100);
  };

  useEffect(() => {
    return () => clearTimeout(popoverTimerRef.current);
  }, []);

  return (
    <div className="border-t border-surface-3 px-3 py-3 animate-fadeInUp" style={{ animationDuration: "120ms" }}>
      {/* Contact Info section */}
      <CollapsibleSection title="Contact Info" defaultOpen>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-text-tertiary">Name:</span>{" "}
            <span className="text-text-primary">{contact.firstName ?? ""} {contact.lastName ?? ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary">Email:</span>{" "}
            {displayEmail ? (
              <>
                <span className={`font-mono ${contact.verificationStatus === "invalid" ? "text-text-tertiary line-through" : "text-text-primary"}`}>
                  {displayEmail}
                </span>
                <VerificationBadge status={contact.verificationStatus ?? "unverified"} safeToSend={contact.safeToSend} />
                {contact.fieldSources?.email && (
                  <SourceBadge source={contact.fieldSources.email} />
                )}
              </>
            ) : revealConfirm ? (
              <button
                onClick={onRevealEmail}
                className="flex items-center gap-1 rounded-input border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
              >
                Uses 1 credit — Confirm
              </button>
            ) : (
              <button
                onClick={onRevealClick}
                disabled={revealLoading || revealFailed}
                className="flex items-center gap-1 rounded-input border border-accent-secondary/30 bg-accent-secondary/5 px-2 py-0.5 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-50"
              >
                {revealLoading ? (
                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-accent-secondary/30 border-t-accent-secondary" />
                ) : revealFailed ? (
                  "Not found"
                ) : (
                  "Find email"
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary">Phone:</span>{" "}
            {contact.phone ? (
              <>
                <span className="font-mono text-text-primary">{contact.phone}</span>
                {contact.fieldSources?.phone && (
                  <SourceBadge source={contact.fieldSources.phone} />
                )}
              </>
            ) : (
              <MissingData label="Not available" />
            )}
          </div>
          {show("linkedin") && (
            <div>
              <span className="text-text-tertiary">LinkedIn:</span>{" "}
              {contact.linkedinUrl ? (
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent-secondary hover:underline" onClick={(e) => e.stopPropagation()}>Profile</a>
              ) : (
                <MissingData label="Not found" />
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Professional section */}
      <CollapsibleSection title="Professional" defaultOpen>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-text-tertiary">Title:</span>{" "}
            <span className="text-text-primary">{contact.title ?? ""}</span>
            {contact.fieldSources?.title && (
              <SourceBadge source={contact.fieldSources.title} className="ml-1" />
            )}
          </div>
          {show("seniority") && (
            <div>
              <span className="text-text-tertiary">Seniority:</span>{" "}
              <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-primary">
                {seniorityLabel[contact.seniority] ?? contact.seniority}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-text-tertiary">Sources:</span>{" "}
            <div className="flex gap-0.5">
              {(Array.isArray(contact.sources) ? contact.sources : []).map((src) => (
                <SourceBadge key={src} source={src} />
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Company section */}
      <CollapsibleSection title="Company" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="relative flex items-center gap-1">
            <span className="text-text-tertiary">Company:</span>{" "}
            <span
              ref={chipRef}
              onMouseEnter={handlePopoverEnter}
              onMouseLeave={handlePopoverLeave}
              className="cursor-default rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-primary"
            >
              {contact.companyName ?? "\u2014"}
            </span>
            {popoverOpen && company && (
              <CompanyPopover
                company={company}
                onMouseEnter={handlePopoverEnter}
                onMouseLeave={handlePopoverLeave}
                onViewDossier={onViewDossier}
              />
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Actions row */}
      <ContactCardActions
        contact={contact}
        displayEmail={displayEmail}
        revealConfirm={revealConfirm}
        revealLoading={revealLoading}
        revealFailed={revealFailed}
        addedToCrm={addedToCrm}
        freshsalesEnablePushContact={freshsalesEnablePushContact}
        company={company}
        onRevealEmail={onRevealEmail}
        onRevealClick={onRevealClick}
        onCopyEmail={onCopyEmail}
        onViewDossier={onViewDossier}
        onDraftEmail={onDraftEmail}
        onExclude={onExclude}
        onShowAddToCrm={onShowAddToCrm}
        FeedbackLabel={FeedbackLabel}
      />
    </div>
  );
});

function CompanyPopover({
  company,
  onMouseEnter,
  onMouseLeave,
  onViewDossier,
}: {
  company: CompanyEnriched;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onViewDossier: (e: React.MouseEvent) => void;
}) {
  const statusLabel: Record<string, string> = {
    none: "No CRM record",
    new_lead: "New Lead",
    contacted: "Contacted",
    negotiation: "Negotiation",
    won: "Won",
    lost: "Lost",
    customer: "Customer",
    new: "New",
    open: "Open",
    in_progress: "In Progress",
    closed_won: "Closed Won",
    closed_lost: "Closed Lost",
  };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute bottom-full left-0 z-30 mb-1 w-56 rounded-card border border-surface-3 bg-surface-1 p-3 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">{company.name ?? "Unknown"}</span>
        <IcpScoreBadge score={company.icpScore ?? 0} />
      </div>
      <p className="mt-0.5 text-[10px] text-text-tertiary">{company.domain}</p>
      <div className="mt-2 space-y-1 text-xs">
        <div>
          <span className="text-text-tertiary">Employees:</span>{" "}
          <span className="text-text-secondary">{company.employeeCount?.toLocaleString() ?? "\u2014"}</span>
        </div>
        <div>
          <span className="text-text-tertiary">Industry:</span>{" "}
          <span className="text-text-secondary">{company.industry || company.vertical || "\u2014"}</span>
        </div>
        {company.hubspotStatus !== "none" && (
          <div>
            <span className="text-text-tertiary">HubSpot:</span>{" "}
            <span className="text-text-secondary">{statusLabel[company.hubspotStatus] ?? company.hubspotStatus}</span>
          </div>
        )}
        {company.freshsalesStatus !== "none" && (
          <div>
            <span className="text-text-tertiary">Freshsales:</span>{" "}
            <span className="text-text-secondary">{statusLabel[company.freshsalesStatus] ?? company.freshsalesStatus}</span>
          </div>
        )}
        {company.freshsalesIntel?.account?.owner && (
          <div>
            <span className="text-text-tertiary">CRM Owner:</span>{" "}
            <span className="text-accent-secondary">{company.freshsalesIntel.account.owner.name}</span>
          </div>
        )}
      </div>
      <button
        onClick={onViewDossier}
        className="mt-2 text-[10px] text-accent-secondary hover:underline"
      >
        View dossier
      </button>
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
        className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform duration-[180ms] ${open ? "" : "-rotate-90"}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {title}
      </button>
      {open && children}
    </div>
  );
}
