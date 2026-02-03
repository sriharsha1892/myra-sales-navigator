"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useExport } from "@/hooks/useExport";
import { ExportContactPicker } from "@/components/export/ExportContactPicker";
import { VerificationProgress } from "@/components/export/VerificationProgress";
import { BulkStatusDropdown } from "./BulkStatusDropdown";
import { BulkNoteInput } from "./BulkNoteInput";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "./AnimatedNumber";
import { pick } from "@/lib/ui-copy";

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

  const selectedIds = viewMode === "contacts" ? selectedContactIds : selectedCompanyDomains;
  const clearSelection = viewMode === "contacts" ? deselectAllContacts : deselectAllCompanies;
  const count = selectedIds.size;
  const domains = Array.from(selectedCompanyDomains);

  const handleBulkExclude = async () => {
    if (!userName) return;
    // Optimistic local exclusion
    for (const domain of domains) {
      excludeCompany(domain);
    }
    // Persist via bulk API
    try {
      await fetch("/api/bulk/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains, userName }),
      });
      addToast({ message: pick("exclusion_success").replace("N", String(domains.length)), type: "success" });
    } catch {
      addToast({ message: "Failed to bulk exclude", type: "error" });
    }
    clearSelection();
  };

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
      addToast({ message: "Failed to bulk update status", type: "error" });
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
      addToast({ message: "Failed to bulk add note", type: "error" });
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
              </span>{" "}selected
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
                <BulkButton onClick={() => initiateExport("clipboard")} label="Copy" />
                <BulkButton onClick={() => initiateExport("csv")} label="CSV" />
                <BulkButton onClick={() => initiateExport("excel")} label="Excel" />
                {viewMode === "companies" && (
                  <>
                    <BulkButton onClick={handleBulkExclude} label="Exclude" variant="danger" />
                    <BulkButton onClick={() => setShowStatusDropdown(true)} label="Set Status" />
                    <BulkButton onClick={() => setShowNoteInput(true)} label="Add Note" />
                  </>
                )}
                <BulkButton onClick={clearSelection} label="Clear" variant="ghost" />
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
    </>
  );
}

function BulkButton({
  onClick,
  label,
  variant = "default",
}: {
  onClick: () => void;
  label: string;
  variant?: "default" | "ghost" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-input px-3 py-1.5 text-sm font-medium transition-all duration-[var(--transition-default)]",
        variant === "default"
          ? "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover"
          : variant === "danger"
          ? "bg-danger/10 text-danger hover:bg-danger/20"
          : "text-text-secondary hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}
