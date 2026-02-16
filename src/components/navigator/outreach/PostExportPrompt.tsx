"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import { SequenceEnrollModal } from "./SequenceEnrollModal";

export function PostExportPrompt() {
  const lastExport = useStore((s) => s.lastExportedContacts);
  const [showEnroll, setShowEnroll] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [lastExport?.timestamp]);

  useEffect(() => {
    if (!lastExport || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), 15000);
    return () => clearTimeout(timer);
  }, [lastExport, dismissed]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const handleEnroll = useCallback(() => {
    setShowEnroll(true);
  }, []);

  if (!lastExport || dismissed) return null;

  const contactCount = lastExport.contacts.length;
  const companyLabel = lastExport.primaryDomain
    ? lastExport.contacts.find((c) => c.companyDomain === lastExport.primaryDomain)?.companyName ?? lastExport.primaryDomain
    : `${lastExport.domains.length} companies`;

  return (
    <>
      <div className="animate-fadeInUp fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-card border border-accent-primary/30 bg-surface-1 px-4 py-3 shadow-lg">
          <span className="text-xs text-text-secondary">
            Exported {contactCount} contact{contactCount !== 1 ? "s" : ""} from{" "}
            <span className="font-medium text-text-primary">{companyLabel}</span>
          </span>
          <button
            onClick={handleEnroll}
            className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover"
          >
            Enroll in Sequence
          </button>
          <button
            onClick={handleDismiss}
            className="text-text-tertiary transition-colors hover:text-text-secondary"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {showEnroll && lastExport.primaryDomain && (
        <SequenceEnrollModal
          contactIds={lastExport.contacts.map((c) => c.id)}
          companyDomain={lastExport.primaryDomain}
          onClose={() => {
            setShowEnroll(false);
            setDismissed(true);
          }}
        />
      )}
    </>
  );
}
