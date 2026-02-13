"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useStore } from "@/lib/navigator/store";
import { ConfirmDialog } from "@/components/navigator/shared/ConfirmDialog";
import { useExport } from "@/hooks/navigator/useExport";
import { ExportContactPicker } from "@/components/navigator/export/ExportContactPicker";
import { VerificationProgress } from "@/components/navigator/export/VerificationProgress";
import { BulkStatusDropdown } from "./BulkStatusDropdown";
import { BulkNoteInput } from "./BulkNoteInput";
import { BulkSequenceEnrollModal } from "@/components/navigator/outreach/BulkSequenceEnrollModal";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "./AnimatedNumber";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import { pick } from "@/lib/navigator/ui-copy";
import { CompanyComparisonModal } from "@/components/navigator/comparison/CompanyComparisonModal";

export function BulkActionBar() {
  const viewMode = useStore((s) => s.viewMode);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const deselectAllContacts = useStore((s) => s.deselectAllContacts);
  const deselectAllCompanies = useStore((s) => s.deselectAllCompanies);
  const userName = useStore((s) => s.userName);
  const addToast = useStore((s) => s.addToast);
  const setCompanyStatus = useStore((s) => s.setCompanyStatus);
  const excludeCompany = useStore((s) => s.excludeCompany);

  const { initiateExport, exportPickedContacts, exportState, setExportState } = useExport();

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showExcludeConfirm, setShowExcludeConfirm] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const allContactsViewActive = useStore((s) => s.allContactsViewActive);
  const bulkLoadContacts = useStore((s) => s.bulkLoadContacts);
  const bulkContactsLoadingSize = useStore((s) => s.bulkContactsLoading?.size ?? 0);

  const isContactMode = allContactsViewActive && selectedContactIds.size > 0;
  const clearSelection = isContactMode ? deselectAllContacts : deselectAllCompanies;
  const count = isContactMode ? selectedContactIds.size : selectedCompanyDomains.size;
  const domains = Array.from(selectedCompanyDomains);

  const totalCount = filteredCompanies().length;

  // Count contacts available for selected companies (for export button state)
  const contactCountForSelected = useMemo(() => {
    let total = 0;
    for (const domain of domains) {
      const domainContacts = contactsByDomain[domain];
      if (domainContacts) total += domainContacts.length;
    }
    return total;
  }, [domains, contactsByDomain]);
  const someContactsMissing = useMemo(() => {
    return domains.some((d) => contactsByDomain[d] === undefined);
  }, [domains, contactsByDomain]);
  const missingContactsCount = useMemo(() => {
    return domains.filter((d) => contactsByDomain[d] === undefined).length;
  }, [domains, contactsByDomain]);
  const isBulkLoading = bulkContactsLoadingSize > 0;

  const exportDisabled = contactCountForSelected === 0;
  const exportTooltip = isBulkLoading
    ? `Loading contacts... (${bulkContactsLoadingSize} left)`
    : someContactsMissing && exportDisabled
      ? "Load contacts first"
      : exportDisabled
        ? "Select contacts first"
        : "";

  const addUndoToast = useStore((s) => s.addUndoToast);
  const undoExclude = useStore((s) => s.undoExclude);

  // Build contacts list from selected companies for bulk enrollment
  const enrollableContacts = useMemo(() => {
    const contacts: Array<{ contactId: string; companyDomain: string }> = [];
    for (const domain of domains) {
      const domainContacts = contactsByDomain[domain];
      if (domainContacts) {
        for (const c of domainContacts) {
          contacts.push({ contactId: c.id, companyDomain: domain });
        }
      }
    }
    return contacts;
  }, [domains, contactsByDomain]);

  // Auto-load contacts when <=10 selected domains are missing contacts
  const autoLoadFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (isBulkLoading || !someContactsMissing || missingContactsCount > 10) return;
    // Build a stable key from selected domains to avoid re-firing
    const key = [...selectedCompanyDomains].sort().join(",");
    if (autoLoadFiredRef.current === key) return;
    autoLoadFiredRef.current = key;
    bulkLoadContacts([...selectedCompanyDomains]);
  }, [selectedCompanyDomains, someContactsMissing, missingContactsCount, isBulkLoading, bulkLoadContacts]);

  const handleBulkExclude = useCallback(async () => {
    setShowExcludeConfirm(false);
    if (!userName) return;
    // Snapshot domains before clearing selection
    const domainsSnapshot = [...domains];
    // Optimistic local exclusion
    for (const domain of domainsSnapshot) {
      excludeCompany(domain);
    }
    clearSelection();
    // Show undo toast for all bulk exclusions
    addUndoToast(
      `Excluded ${domainsSnapshot.length} compan${domainsSnapshot.length === 1 ? "y" : "ies"}`,
      () => { domainsSnapshot.forEach((d) => undoExclude(d)); }
    );
    // Persist via bulk API
    try {
      await fetch("/api/bulk/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: domainsSnapshot, userName }),
      });
    } catch {
      addToast({ message: pick("bulk_action_failed"), type: "error" });
    }
  }, [domains, userName, excludeCompany, addToast, clearSelection, addUndoToast, undoExclude]);

  const requestBulkExclude = useCallback(() => {
    if (domains.length > 3) {
      // Medium/High-risk: show confirmation dialog, undo toast after confirm
      setShowExcludeConfirm(true);
    } else {
      // Low (1-3): execute immediately with undo toast
      handleBulkExclude();
    }
  }, [domains, handleBulkExclude]);

  const handleBulkStatus = async (status: string) => {
    if (!userName) return;
    for (const domain of domains) {
      setCompanyStatus(domain, status, userName);
    }
    try {
      await fetch("/api/bulk/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains, status, userName }),
      });
      addToast({ message: pick("bulk_status_update").replace("N", String(domains.length)), type: "success" });
    } catch {
      addToast({ message: pick("bulk_action_failed"), type: "error" });
    }
    setShowStatusDropdown(false);
  };

  const handleBulkNote = async (text: string) => {
    if (!userName) return;
    try {
      await fetch("/api/bulk/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains, text, userName }),
      });
      addToast({ message: `Added note to ${domains.length} companies`, type: "success" });
    } catch {
      addToast({ message: pick("bulk_action_failed"), type: "error" });
    }
    setShowNoteInput(false);
  };

  if (count < 1 && !exportState) return null;

  return (
    <>
      {count >= 1 && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 glass-panel border-t-2 border-accent-primary px-6 py-3 shadow-lg",
            "animate-[slideUp_180ms_ease-out]"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-accent-primary">
              <span key={count} className="inline-block" style={{ animation: "countBounce 200ms ease-out" }}>
                <AnimatedNumber value={count} />
              </span>
              {!isContactMode && totalCount > 0 && (
                <span className="font-normal text-text-tertiary"> of {totalCount}</span>
              )}{" "}{isContactMode ? "contacts selected" : "selected"}
            </span>

            {showStatusDropdown ? (
              <BulkStatusDropdown
                onSelect={handleBulkStatus}
                onCancel={() => setShowStatusDropdown(false)}
              />
            ) : showNoteInput ? (
              <BulkNoteInput
                onSubmit={handleBulkNote}
                onCancel={() => setShowNoteInput(false)}
              />
            ) : (
              <div className="flex items-center gap-2">
                {isBulkLoading ? (
                  <BulkButton onClick={() => {}} label={`Loading... (${bulkContactsLoadingSize} left)`} disabled />
                ) : someContactsMissing && !isContactMode ? (
                  <BulkButton
                    onClick={() => bulkLoadContacts([...selectedCompanyDomains])}
                    label={`Load Contacts (${missingContactsCount})`}
                  />
                ) : null}
                <Tooltip text={exportTooltip}>
                  <BulkButton onClick={() => initiateExport("clipboard")} label="Copy" shortcut="\u2318E" disabled={exportDisabled} />
                </Tooltip>
                <Tooltip text={exportTooltip}>
                  <BulkButton onClick={() => initiateExport("csv")} label="CSV" disabled={exportDisabled} />
                </Tooltip>
                <Tooltip text={exportTooltip}>
                  <BulkButton onClick={() => initiateExport("excel")} label="Excel" disabled={exportDisabled} />
                </Tooltip>
                {viewMode === "companies" && !isContactMode && (
                  <>
                    {count >= 2 && count <= 3 && (
                      <BulkButton onClick={() => setShowComparison(true)} label="Compare" />
                    )}
                    <BulkButton
                      onClick={() => setShowEnrollModal(true)}
                      label={`Enroll${enrollableContacts.length > 0 ? ` (${enrollableContacts.length})` : ""}`}
                    />
                    <BulkButton onClick={requestBulkExclude} label="Exclude" variant="danger" />
                    <BulkButton onClick={() => setShowStatusDropdown(true)} label="Set Status" />
                    <BulkButton onClick={() => setShowNoteInput(true)} label="Add Note" />
                  </>
                )}
                <Tooltip text="Clear selection (Esc)">
                  <BulkButton onClick={clearSelection} label="Clear" variant="ghost" />
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      )}

      {exportState?.step === "picking" && (
        <ExportContactPicker
          contactIds={exportState.contactIds}
          mode={exportState.mode}
          onExport={exportPickedContacts}
          onCancel={() => setExportState(null)}
        />
      )}

      {exportState?.step === "verify" && (
        <VerificationProgress exportState={exportState} />
      )}

      <ConfirmDialog
        open={showExcludeConfirm}
        title={domains.length > 10 ? "Exclude many companies?" : "Exclude companies?"}
        message={
          domains.length > 10
            ? `You're about to exclude ${domains.length} companies — this is a large batch. They will be hidden from all future search results.`
            : `You're about to exclude ${domains.length} companies. They will be hidden from future search results.`
        }
        confirmLabel={`Exclude ${domains.length}`}
        onConfirm={handleBulkExclude}
        onCancel={() => setShowExcludeConfirm(false)}
        destructive
      />

      {showEnrollModal && (
        <BulkSequenceEnrollModal
          contacts={enrollableContacts}
          onClose={() => setShowEnrollModal(false)}
        />
      )}

      {showComparison && (
        <CompanyComparisonModal
          domains={domains}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}

function BulkButton({
  onClick,
  label,
  variant = "default",
  shortcut,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  variant?: "default" | "ghost" | "danger";
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "rounded-input px-3 py-1.5 text-sm font-medium transition-all duration-[var(--transition-default)] flex items-center gap-1.5",
        disabled
          ? "opacity-40 cursor-not-allowed bg-accent-primary text-text-inverse"
          : variant === "default"
          ? "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover"
          : variant === "danger"
          ? "bg-danger/10 text-danger hover:bg-danger/20"
          : "text-text-secondary hover:text-text-primary"
      )}
    >
      {label}
      {shortcut && (
        <kbd className="rounded border border-white/20 bg-white/10 px-1 py-px font-mono text-[10px] leading-none opacity-70">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
