"use client";

import { cn } from "@/lib/cn";
import type { Contact } from "@/lib/types";
import { SourceBadge, ConfidenceBadge } from "@/components/badges";
import { MissingData } from "@/components/shared/MissingData";
import { useInlineFeedback } from "@/hooks/useInlineFeedback";

interface ContactCardProps {
  contact: Contact;
  isChecked: boolean;
  onToggleCheck: () => void;
}

export function ContactCard({ contact, isChecked, onToggleCheck }: ContactCardProps) {
  const { trigger, FeedbackLabel } = useInlineFeedback();

  const initials =
    (contact.firstName?.[0] ?? "") + (contact.lastName?.[0] ?? "");

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contact.email) return;
    navigator.clipboard.writeText(contact.email).then(() => {
      trigger("Copied");
    }).catch(() => {
      trigger("Failed", "error");
    });
  };

  return (
    <div role="option" tabIndex={-1} className="group rounded-card border border-surface-3 bg-surface-1 p-3 transition-shadow duration-[var(--transition-default)] hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggleCheck}
          className="mt-1 h-3.5 w-3.5 flex-shrink-0 rounded accent-accent-primary"
        />

        {/* Avatar */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary-light text-xs font-semibold text-accent-primary">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          {/* Name + company chip */}
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary">
              {contact.firstName} {contact.lastName}
            </span>
            <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-secondary">
              {contact.companyName}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {contact.title}
          </p>

          {/* Email + confidence + copy */}
          <div className="mt-1.5 flex items-center gap-2">
            {contact.email ? (
              <>
                <span className="truncate font-mono text-xs text-text-secondary">
                  {contact.email}
                </span>
                <ConfidenceBadge
                  level={contact.confidenceLevel}
                  score={contact.emailConfidence}
                />
                <button
                  onClick={handleCopyEmail}
                  className="flex-shrink-0 text-text-tertiary opacity-50 transition-opacity hover:text-accent-primary group-hover:opacity-100"
                  title="Copy email"
                  aria-label="Copy email"
                >
                  <CopyIcon />
                </button>
                {FeedbackLabel}
              </>
            ) : (
              <MissingData label="No email found" />
            )}
          </div>

          {/* Phone + sources */}
          <div className="mt-1 flex items-center gap-2">
            {contact.phone ? (
              <span className="font-mono text-xs text-text-tertiary">
                {contact.phone}
              </span>
            ) : (
              <MissingData label="No phone available" />
            )}
            <div className="ml-auto flex gap-0.5">
              {(Array.isArray(contact.sources) ? contact.sources : []).map((src) => (
                <SourceBadge key={src} source={src} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
