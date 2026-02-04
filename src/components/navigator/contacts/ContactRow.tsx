"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { cn } from "@/lib/cn";
import { ConfidenceBadge, SourceBadge, VerificationBadge } from "@/components/navigator/badges";
import { MissingData } from "@/components/navigator/shared/MissingData";
import { useInlineFeedback } from "@/hooks/navigator/useInlineFeedback";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import type { Contact, ResultSource } from "@/lib/navigator/types";

const fieldSourceLabels: Partial<Record<ResultSource, string>> = {
  apollo: "A",
  hubspot: "H",
  freshsales: "F",
  exa: "E",
  mordor: "M",
};

const sourceFullNames: Partial<Record<ResultSource, string>> = {
  apollo: "Apollo (contacts database)",
  hubspot: "HubSpot (CRM)",
  freshsales: "Freshsales (CRM)",
  exa: "Exa (web intelligence)",
  mordor: "Mordor (internal)",
};

function FieldSourceTag({ source }: { source: ResultSource }) {
  return (
    <Tooltip text={sourceFullNames[source] ?? source.charAt(0).toUpperCase() + source.slice(1)}>
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-surface-2 font-mono text-[8px] font-bold text-text-tertiary">
        {fieldSourceLabels[source] ?? source[0].toUpperCase()}
      </span>
    </Tooltip>
  );
}

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isObfuscated(name: string): boolean {
  return name.includes("***");
}

const seniorityLabels: Record<string, string> = {
  c_level: "C-Level",
  vp: "VP",
  director: "Director",
  manager: "Manager",
  staff: "Staff",
};

interface ContactRowProps {
  contact: Contact;
  selected: boolean;
  isFocused: boolean;
  variant: "compact" | "expanded";
  onToggle: () => void;
  onDraftEmail: () => void;
  exportInfo?: { exportedBy: string; exportedAt: string };
}

export function ContactRow({
  contact,
  selected,
  isFocused,
  variant,
  onToggle,
  onDraftEmail,
  exportInfo,
}: ContactRowProps) {
  const queryClient = useQueryClient();
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
        const merged = {
          ...contact,
          ...data.contact,
          id: contact.id,
          companyDomain: contact.companyDomain,
          sources: contact.sources,
        };
        updateContact(contact.companyDomain, contact.id, merged);

        // Persist to server cache (fire-and-forget)
        if (merged.email && contact.companyDomain) {
          fetch("/api/contact/persist-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              domain: contact.companyDomain,
              contactId: contact.id,
              email: merged.email,
              emailConfidence: merged.emailConfidence ?? 70,
              confidenceLevel: merged.confidenceLevel ?? "medium",
            }),
          }).catch(() => {});
        }

        // Patch TanStack Query cache inline
        queryClient.setQueriesData<Contact[]>(
          { queryKey: ["company-contacts", contact.companyDomain] },
          (old) => old?.map((c) =>
            c.id === contact.id ? { ...c, ...merged } : c
          ),
        );
      }
    } catch {
      trigger("Couldn't reveal — try again", "error");
    } finally {
      setRevealing(false);
    }
  }, [contact, updateContact, trigger, queryClient]);

  const handleCopy = (email: string) => {
    navigator.clipboard
      .writeText(email)
      .then(() => trigger("Copied"))
      .catch(() => trigger("Copy failed", "error"));
  };

  const inFreshsales = contact.sources.includes("freshsales");

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "rounded-card border px-3 py-2 transition-all duration-[180ms]",
          isFocused
            ? "border-accent-secondary/40 bg-accent-secondary/5"
            : "border-surface-3 bg-surface-0",
        )}
      >
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-3 w-3 flex-shrink-0 rounded accent-accent-primary"
            tabIndex={-1}
          />
          <span className="truncate text-xs font-medium text-text-primary">
            {contact.firstName} {contact.lastName}
          </span>
          <span className="text-[10px] text-text-tertiary">
            {seniorityLabels[contact.seniority] ?? contact.seniority}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 pl-5">
          {contact.email ? (
            <span className="truncate font-mono text-[11px] text-text-secondary">
              {contact.email}
            </span>
          ) : (
            <MissingData label="No email" />
          )}
          {inFreshsales && (
            <span className="rounded-pill px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "rgba(62, 166, 123, 0.12)", color: "#3EA67B" }}>
              In CRM
            </span>
          )}
        </div>
      </div>
    );
  }

  // Expanded variant
  return (
    <div
      className={cn(
        "rounded-card border px-3 py-2.5 transition-all duration-[180ms]",
        isFocused
          ? "border-accent-secondary/40 bg-accent-secondary/5"
          : "border-surface-3 bg-surface-0",
      )}
    >
      {/* Line 1: name + seniority + checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-3 w-3 flex-shrink-0 rounded accent-accent-primary"
          tabIndex={-1}
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

      {/* Title */}
      <p className="mt-0.5 pl-5 text-xs text-text-secondary">{contact.title}</p>

      {/* Email row */}
      <div className="mt-1 flex items-center gap-2 pl-5">
        {contact.email ? (
          <>
            <span className={`font-mono text-sm ${contact.verificationStatus === "invalid" ? "text-text-tertiary line-through" : "text-text-secondary"}`}>
              {contact.email}
            </span>
            {contact.fieldSources?.email && (
              <FieldSourceTag source={contact.fieldSources.email} />
            )}
            <VerificationBadge
              status={contact.verificationStatus ?? "unverified"}
              safeToSend={contact.safeToSend}
            />
            <Tooltip text="Copy email">
              <button
                onClick={() => handleCopy(contact.email!)}
                className="text-text-tertiary hover:text-accent-primary"
                aria-label="Copy email"
              >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            </Tooltip>
            {FeedbackLabel}
          </>
        ) : (
          <MissingData label="No email found" />
        )}
      </div>

      {/* Phone row */}
      <div className="mt-1 flex items-center gap-2 pl-5">
        {contact.phone ? (
          <p className="flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
            {contact.phone}
            {contact.fieldSources?.phone && (
              <FieldSourceTag source={contact.fieldSources.phone} />
            )}
          </p>
        ) : (
          <MissingData label="No phone" />
        )}
      </div>

      {/* LinkedIn */}
      {contact.linkedinUrl && (
        <div className="mt-1 pl-5">
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-accent-secondary transition-colors hover:underline"
          >
            LinkedIn
          </a>
        </div>
      )}

      {/* Freshsales status */}
      {inFreshsales && (
        <div className="mt-1 flex items-center gap-2 pl-5">
          <span className="rounded-pill px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "rgba(62, 166, 123, 0.12)", color: "#3EA67B" }}>
            In CRM
          </span>
        </div>
      )}

      {/* Export history */}
      {exportInfo && (
        <p className="mt-1 pl-5 text-[10px] text-text-tertiary">
          Exported {timeAgoShort(exportInfo.exportedAt)} by {exportInfo.exportedBy}
        </p>
      )}

      {/* Actions row */}
      <div className="mt-1.5 flex items-center justify-end gap-2 pl-5">
        {contact.email && (
          <button
            onClick={onDraftEmail}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-accent-primary opacity-70 transition-all hover:bg-accent-primary-light hover:opacity-100"
          >
            Draft Email
          </button>
        )}
      </div>
    </div>
  );
}
