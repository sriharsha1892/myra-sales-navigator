"use client";

import { useState, useCallback } from "react";
import { Overlay } from "@/components/primitives/Overlay";
import { useStore } from "@/lib/navigator/store";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import type { BriefingData } from "@/lib/navigator/types";

interface ExecutionModalProps {
  channel: string;
  contactName: string;
  companyName: string;
  draft: string | null;
  subject?: string | null;
  linkedinUrl?: string | null;
  briefing?: BriefingData | null;
  onDone: () => void;
  onClose: () => void;
}

export function ExecutionModal({
  channel,
  contactName,
  companyName,
  draft,
  subject: initialSubject,
  linkedinUrl,
  briefing,
  onDone,
  onClose,
}: ExecutionModalProps) {
  const addToast = useStore((s) => s.addToast);
  const [subjectText, setSubjectText] = useState(initialSubject ?? "");
  const [bodyText, setBodyText] = useState(draft ?? "");

  const channelOpt = CHANNEL_OPTIONS.find((o) => o.value === channel);
  const channelLabel = channelOpt?.label ?? channel;
  const isEmail = channel === "email";
  const isLinkedIn = channel === "linkedin_connect" || channel === "linkedin_inmail";
  const isWhatsApp = channel === "whatsapp";

  const handleCopy = useCallback(async () => {
    const text = isEmail && subjectText
      ? `Subject: ${subjectText}\n\n${bodyText}`
      : bodyText;
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message: "Copied to clipboard", type: "success" });
    } catch {
      addToast({ message: "Failed to copy", type: "error" });
    }
  }, [isEmail, subjectText, bodyText, addToast]);

  const handleOpenExternal = useCallback(() => {
    if (isLinkedIn && linkedinUrl) {
      window.open(linkedinUrl, "_blank", "noopener");
    } else if (isWhatsApp) {
      // WhatsApp web with pre-filled message
      const encoded = encodeURIComponent(bodyText);
      window.open(`https://web.whatsapp.com/?text=${encoded}`, "_blank", "noopener");
    }
  }, [isLinkedIn, isWhatsApp, linkedinUrl, bodyText]);

  return (
    <Overlay open={true} onClose={onClose} backdrop="blur" placement="center">
      <div className="w-full max-w-[520px] rounded-card border border-surface-3 bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="font-display text-base font-medium text-text-primary">
              {channelLabel} Draft
            </h3>
            <p className="mt-0.5 truncate text-xs text-text-tertiary">
              {contactName} at {companyName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-lg p-2 text-text-tertiary transition-colors duration-[180ms] hover:bg-surface-2 hover:text-text-primary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Briefing context */}
        {briefing && (
          <div className="border-b border-surface-3 px-5 pb-3 pt-3 space-y-1">
            <p className="text-xs text-text-primary font-medium">
              {briefing.contact.name} &middot; {briefing.contact.title}
            </p>
            <p className="text-[10px] text-text-tertiary">
              {briefing.company.industry} &middot; {briefing.company.employeeCount?.toLocaleString()} emp &middot; ICP {briefing.company.icpScore}
            </p>
            {briefing.topSignal && (
              <p className="text-[10px] text-accent-secondary">{briefing.topSignal.title}</p>
            )}
          </div>
        )}

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          {/* Subject line for email */}
          {isEmail && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Subject
              </label>
              <input
                type="text"
                value={subjectText}
                onChange={(e) => setSubjectText(e.target.value)}
                className="w-full rounded-input border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary placeholder:text-text-tertiary"
              />
            </div>
          )}

          {/* Draft body */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {isEmail ? "Message" : "Draft"}
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={8}
              className="w-full resize-y rounded-input border border-surface-3 bg-surface-0 px-3 py-2 text-xs leading-relaxed text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary placeholder:text-text-tertiary"
            />
          </div>

          {!draft && (
            <p className="text-xs text-amber-400/80">
              Draft generation failed — write your message manually above.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-surface-3 px-5 py-3">
          <div className="flex items-center gap-2">
            {(isLinkedIn && linkedinUrl) && (
              <button
                onClick={handleOpenExternal}
                className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2"
              >
                Open LinkedIn
              </button>
            )}
            {isWhatsApp && (
              <button
                onClick={handleOpenExternal}
                className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2"
              >
                Open WhatsApp
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              onClick={onDone}
              className="rounded-input bg-accent-primary px-4 py-1.5 text-xs font-medium text-surface-0 transition-opacity duration-[180ms] hover:opacity-90"
            >
              Mark Done
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
