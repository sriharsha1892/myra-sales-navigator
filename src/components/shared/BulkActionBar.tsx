"use client";

import { useStore } from "@/lib/store";
import { useExport } from "@/hooks/useExport";
import { ExportContactPicker } from "@/components/export/ExportContactPicker";
import { cn } from "@/lib/cn";

export function BulkActionBar() {
  const viewMode = useStore((s) => s.viewMode);
  const selectedContactIds = useStore((s) => s.selectedContactIds);
  const selectedCompanyDomains = useStore((s) => s.selectedCompanyDomains);
  const deselectAllContacts = useStore((s) => s.deselectAllContacts);
  const deselectAllCompanies = useStore((s) => s.deselectAllCompanies);

  const { initiateExport, exportPickedContacts, exportState, setExportState } = useExport();

  const selectedIds = viewMode === "contacts" ? selectedContactIds : selectedCompanyDomains;
  const clearSelection = viewMode === "contacts" ? deselectAllContacts : deselectAllCompanies;
  const count = selectedIds.size;

  if (count < 2 && !exportState) return null;

  return (
    <>
      {count >= 2 && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-surface-3 bg-surface-1 px-6 py-3 shadow-lg",
            "animate-[slideUp_180ms_ease-out]"
          )}
        >
          <span className="text-sm font-medium text-text-primary">
            {count} selected
          </span>
          <div className="flex items-center gap-2">
            <BulkButton onClick={() => initiateExport("clipboard")} label="Copy to Clipboard" />
            <BulkButton onClick={() => initiateExport("csv")} label="Export CSV" />
            <BulkButton onClick={clearSelection} label="Clear" variant="ghost" />
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
  variant?: "default" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-input px-3 py-1.5 text-sm font-medium transition-all duration-[var(--transition-default)]",
        variant === "default"
          ? "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover"
          : "text-text-secondary hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}
