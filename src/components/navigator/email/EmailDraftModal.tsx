"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import { Overlay } from "@/components/primitives/Overlay";
import { useInlineFeedback } from "@/hooks/navigator/useInlineFeedback";
import type {
  Contact,
  CompanyEnriched,
  Signal,
  EmailTone,
  EmailTemplate,
  EmailDraftResponse,
  HubSpotStatus,
} from "@/lib/navigator/types";

interface EmailDraftModalProps {
  contact: Contact;
  company: CompanyEnriched;
  onClose: () => void;
}

const TONE_OPTIONS: { value: EmailTone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "direct", label: "Direct" },
];

const TEMPLATE_OPTIONS: { value: EmailTemplate | ""; label: string }[] = [
  { value: "intro", label: "Cold Intro" },
  { value: "follow_up", label: "Follow-up" },
  { value: "re_engagement", label: "Re-engagement" },
];

export function EmailDraftModal({ contact, company, onClose }: EmailDraftModalProps) {
  const addToast = useStore((s) => s.addToast);
  const emailPrompts = useStore((s) => s.adminConfig.emailPrompts);
  const { trigger, FeedbackLabel } = useInlineFeedback();

  const [tone, setTone] = useState<EmailTone>(emailPrompts.defaultTone);
  const [template, setTemplate] = useState<EmailTemplate | "">(emailPrompts.defaultTemplate);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: `${contact.firstName} ${contact.lastName}`,
          contactTitle: contact.title,
          companyName: company.name,
          companyIndustry: company.industry || company.vertical || "Technology",
          signals: company.signals?.slice(0, 5) ?? ([] as Signal[]),
          hubspotStatus: (company.hubspotStatus || "none") as HubSpotStatus,
          template: template || undefined,
          tone,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const draft: EmailDraftResponse = await res.json();
      setSubject(draft.subject);
      setBody(draft.body);
      setHasGenerated(true);
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : "Failed to generate email",
        type: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [contact, company, tone, template, addToast]);

  const handleCopy = useCallback(() => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullEmail).then(() => {
      trigger("Copied");
    }).catch(() => {
      trigger("Failed", "error");
    });
  }, [subject, body, trigger]);

  return (
    <Overlay open={true} onClose={onClose} backdrop="blur" placement="center">
      <div className="w-full max-w-[560px] rounded-card border border-surface-3 bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <div>
            <h3 className="font-display text-base font-medium text-text-primary">
              Draft Email
            </h3>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {contact.firstName} {contact.lastName} at {company.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="flex gap-3 border-b border-surface-3 px-5 py-3">
          {/* Template selector */}
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Template
            </label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as EmailTemplate | "")}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-2.5 py-1.5 text-xs text-text-primary outline-none transition-colors focus:border-accent-primary"
            >
              {TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tone selector */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Tone
            </label>
            <div className="flex gap-1">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    tone === opt.value
                      ? "bg-accent-primary/15 text-accent-primary"
                      : "bg-surface-0 text-text-secondary hover:bg-surface-2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Draft area */}
        <div className="px-5 py-4">
          {!hasGenerated && !isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="mb-3 text-sm text-text-secondary">
                Generate a personalized email draft based on prospect data and signals.
              </p>
              <button
                onClick={generate}
                className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                Generate Draft
              </button>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-3 h-5 w-5 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
              <p className="text-xs text-text-tertiary">Generating draft...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Subject */}
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-primary"
                />
              </div>

              {/* Body */}
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full resize-y rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-accent-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {hasGenerated && !isGenerating && (
          <div className="flex items-center justify-between border-t border-surface-3 px-5 py-3">
            <button
              onClick={generate}
              className="rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              Regenerate
            </button>
            <div className="flex items-center gap-2">
              {FeedbackLabel}
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCopy}
                className="rounded-lg bg-accent-primary px-4 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}
