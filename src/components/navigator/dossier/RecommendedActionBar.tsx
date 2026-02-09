"use client";

import { useState, useMemo, lazy, Suspense } from "react";
import { useStore } from "@/lib/navigator/store";
import { recommendAction } from "@/lib/navigator/outreach/recommendAction";
import type { CompanyEnriched, Contact, EmailTemplate } from "@/lib/navigator/types";
import { useOutreachSuggestion } from "@/lib/navigator/outreach/useOutreachSuggestion";

const OutreachDraftModal = lazy(() =>
  import("@/components/navigator/outreach/OutreachDraftModal").then((m) => ({
    default: m.OutreachDraftModal,
  }))
);

interface RecommendedActionBarProps {
  company: CompanyEnriched;
  contacts: Contact[];
}

export function RecommendedActionBar({ company, contacts }: RecommendedActionBarProps) {
  const rawActionRules = useStore((s) => s.adminConfig.actionRecommendationRules);
  const actionRules = useMemo(() => rawActionRules ?? [], [rawActionRules]);
  const rawActionEnabled = useStore((s) => s.adminConfig.actionRecommendationEnabled);
  const actionEnabled = rawActionEnabled ?? true;
  const setExpandedContactsDomain = useStore((s) => s.setExpandedContactsDomain);

  const [dismissed, setDismissed] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);

  const action = useMemo(() => {
    if (!actionEnabled) return null;
    return recommendAction(company, contacts, actionRules);
  }, [company, contacts, actionRules, actionEnabled]);

  const draftContact = useMemo(() => {
    if (!action?.contactId) return contacts[0] ?? null;
    return contacts.find((c) => c.id === action.contactId) ?? contacts[0] ?? null;
  }, [action, contacts]);

  const suggestion = useOutreachSuggestion(company, draftContact, draftOpen);

  if (dismissed || !action || contacts.length === 0) return null;

  const priorityColors = {
    high: "border-accent-primary/30 bg-accent-primary/5",
    medium: "border-surface-3 bg-surface-2/50",
    low: "border-surface-3 bg-surface-2/30",
  };

  const handleAction = () => {
    switch (action.action) {
      case "draft_outreach":
      case "re_engage":
        if (contacts.length > 0) {
          setDraftOpen(true);
        }
        break;
      case "export_contacts":
        setExpandedContactsDomain(company.domain);
        break;
      case "skip":
        setDismissed(true);
        break;
      default:
        break;
    }
  };

  const actionLabels: Record<string, string> = {
    draft_outreach: "Draft Outreach",
    export_contacts: "Load Contacts",
    add_note: "Add Note",
    re_engage: "Draft Follow-up",
    skip: "Dismiss",
  };

  return (
    <>
      <div
        className={`mt-2 flex items-center gap-3 rounded-input border px-3 py-2 ${priorityColors[action.priority]}`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary">{action.label}</p>
          <p className="text-xs text-text-secondary truncate">{action.description}</p>
          {action.reason && (
            <p className="text-[10px] text-text-tertiary truncate">{action.reason}</p>
          )}
        </div>
        <button
          onClick={handleAction}
          className="flex-shrink-0 rounded-lg bg-accent-primary/15 px-3 py-1.5 text-sm font-medium text-accent-primary transition-colors hover:bg-accent-primary/25"
        >
          {actionLabels[action.action] ?? "Act"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {draftOpen && draftContact && (
        <Suspense fallback={null}>
          <OutreachDraftModal
            contact={draftContact}
            company={company}
            onClose={() => setDraftOpen(false)}
            suggestedChannel={suggestion?.channel ?? action.channel}
            suggestedTemplate={suggestion?.template as EmailTemplate | undefined}
            suggestedTone={suggestion?.tone}
            suggestionReason={suggestion?.reason ?? action.description}
          />
        </Suspense>
      )}
    </>
  );
}
