"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import { ConfirmDialog } from "@/components/navigator/shared/ConfirmDialog";
import { useExport } from "@/hooks/navigator/useExport";
import { ExportContactPicker } from "@/components/navigator/export/ExportContactPicker";
import { VerificationProgress } from "@/components/navigator/export/VerificationProgress";
import { BulkStatusDropdown } from "./BulkStatusDropdown";
import { BulkNoteInput } from "./BulkNoteInput";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "./AnimatedNumber";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import { pick } from "@/lib/navigator/ui-copy";

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

  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const contactsByDomain = useStore((s) => s.contactsByDomain);

  const selectedIds = selectedCompanyDomains;
  const clearSelection = deselectAllCompanies;
  const count = selectedIds.size;
  const domains = Array.from(selectedCompanyDomains);

  const totalCount = filteredCompanies().length;

  const addUndoToast = useStore((s) => s.addUndoToast);
  const undoExclude = useStore((s) => s.undoExclude);

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
              {totalCount > 0 && (
                <span className="font-normal text-text-tertiary"> of {totalCount}</span>
              )}{" "}selected
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
                <BulkButton onClick={() => initiateExport("clipboard")} label="Copy" shortcut="\u2318E" />
                <BulkButton onClick={() => initiateExport("csv")} label="CSV" />
                <BulkButton onClick={() => initiateExport("excel")} label="Excel" />
                {viewMode === "companies" && (
                  <>
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
    </>
  );
}

function BulkButton({
  onClick,
  label,
  variant = "default",
  shortcut,
}: {
  onClick: () => void;
  label: string;
  variant?: "default" | "ghost" | "danger";
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-input px-3 py-1.5 text-sm font-medium transition-all duration-[var(--transition-default)] flex items-center gap-1.5",
        variant === "default"
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
