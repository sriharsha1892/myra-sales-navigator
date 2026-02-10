"use client";

import React from "react";
import type { Contact } from "@/lib/navigator/types";
import { VerificationBadge } from "@/components/navigator/badges";
import { Tooltip } from "@/components/navigator/shared/Tooltip";

interface ContactEmailDisplayProps {
  contact: Contact;
  displayEmail: string | null;
  revealConfirm: boolean;
  revealLoading: boolean;
  revealFailed: boolean;
  copySuccess: boolean;
  onRevealEmail: (e: React.MouseEvent) => void;
  onRevealClick: (e: React.MouseEvent) => void;
  onCopyEmail: (e: React.MouseEvent) => void;
}

export const ContactEmailDisplay = React.memo(function ContactEmailDisplay({
  contact,
  displayEmail,
  revealConfirm,
  revealLoading,
  revealFailed,
  copySuccess,
  onRevealEmail,
  onRevealClick,
  onCopyEmail,
}: ContactEmailDisplayProps) {
  const isObfuscated = contact.lastName?.includes("***");
  const verification = contact.verificationStatus;

  // State 1: No email — two-step: click to confirm, then reveal
  if (!displayEmail && !isObfuscated) {
    return revealConfirm ? (
      <button
        onClick={onRevealEmail}
        className="flex items-center gap-1 rounded-input border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
      >
        Uses 1 credit — Confirm
      </button>
    ) : (
      <>
        <button
          onClick={onRevealClick}
          disabled={revealLoading || revealFailed}
          className="flex items-center gap-1 rounded-input border border-accent-secondary/30 bg-accent-secondary/5 px-2 py-0.5 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/10 disabled:opacity-50"
        >
          {revealLoading ? (
            <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-accent-secondary/30 border-t-accent-secondary" />
          ) : revealFailed ? "Not found" : "Find email"}
        </button>
        {revealFailed && (
          <span className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent-secondary hover:underline">LinkedIn</a>
            )}
            {contact.companyDomain && (
              <a href={`https://${contact.companyDomain}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent-secondary hover:underline">Website</a>
            )}
          </span>
        )}
      </>
    );
  }

  // State 2: Obfuscated
  if (!displayEmail && isObfuscated) {
    return revealConfirm ? (
      <button
        onClick={onRevealEmail}
        className="flex items-center gap-1 rounded-input border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
      >
        Uses 1 credit — Confirm reveal
      </button>
    ) : (
      <button
        onClick={onRevealClick}
        disabled={revealLoading}
        className="flex items-center gap-1 rounded-input border border-accent-secondary/30 bg-accent-secondary/10 px-2 py-0.5 text-xs font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/20 disabled:opacity-50"
      >
        {revealLoading ? (
          <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-accent-secondary/30 border-t-accent-secondary" />
        ) : (
          <>&#x25CF;&#x25CF;&#x25CF;@{contact.companyDomain} &mdash; Reveal</>
        )}
      </button>
    );
  }

  // State 5: Invalid
  if (verification === "invalid") {
    return (
      <>
        <span className="truncate font-mono text-sm text-text-tertiary line-through" title={displayEmail ?? undefined}>{displayEmail}</span>
        <VerificationBadge status="invalid" />
        <Tooltip text="Copy email"><button onClick={onCopyEmail} aria-label="Copy email" className="text-text-tertiary hover:text-accent-primary">
          {copySuccess ? <CheckIcon /> : <CopyIcon />}
        </button></Tooltip>
      </>
    );
  }

  // State 4: Verified valid
  if (verification === "valid" || verification === "valid_risky") {
    return (
      <>
        <span className="truncate font-mono text-sm text-text-primary" title={displayEmail ?? undefined}>{displayEmail}</span>
        <VerificationBadge status={verification} safeToSend={contact.safeToSend} />
        <Tooltip text="Copy email"><button onClick={onCopyEmail} aria-label="Copy email" className="text-text-tertiary hover:text-accent-primary">
          {copySuccess ? <CheckIcon /> : <CopyIcon />}
        </button></Tooltip>
      </>
    );
  }

  // State 3: Unverified (has email, no verification)
  return (
    <>
      <span className="truncate font-mono text-sm text-text-secondary" title={displayEmail ?? undefined}>{displayEmail}</span>
      <VerificationBadge status="unverified" />
      <Tooltip text="Copy email"><button onClick={onCopyEmail} aria-label="Copy email" className="text-text-tertiary hover:text-accent-primary">
        {copySuccess ? <CheckIcon /> : <CopyIcon />}
      </button></Tooltip>
    </>
  );
});

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
