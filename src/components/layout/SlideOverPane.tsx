"use client";

import { useStore } from "@/lib/store";
import {
  DossierHeader,
  DossierOverview,
  DossierSignals,
  DossierContacts,
  DossierHubspot,
} from "@/components/dossier";
import { CompanyNotes } from "@/components/notes/CompanyNotes";

export function SlideOverPane() {
  const selectedCompany = useStore((s) => s.selectedCompany);
  const setSlideOverOpen = useStore((s) => s.setSlideOverOpen);
  const excludeCompany = useStore((s) => s.excludeCompany);
  const undoExclude = useStore((s) => s.undoExclude);
  const addUndoToast = useStore((s) => s.addUndoToast);
  const setTriggerExport = useStore((s) => s.setTriggerExport);

  const company = selectedCompany();

  if (!company) return null;

  const handleExclude = () => {
    excludeCompany(company.domain);
    addUndoToast(
      `Excluded ${company.name}`,
      () => undoExclude(company.domain),
      6000
    );
  };

  return (
    <div
      className="w-[420px] flex-shrink-0 border-l border-surface-3 bg-surface-1"
      style={{ animation: "slideOverIn 300ms ease-out" }}
    >
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Close button */}
        <div className="flex flex-shrink-0 items-center justify-end px-4 pt-3">
          <button
            onClick={() => setSlideOverOpen(false)}
            className="text-text-tertiary transition-colors hover:text-text-primary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <DossierHeader company={company} />

        <div className="flex-1 divide-y divide-surface-3">
          <DossierOverview company={company} />
          <DossierSignals signals={company.signals} />
          <DossierContacts companyDomain={company.domain} />
          <DossierHubspot company={company} />
          <CompanyNotes companyDomain={company.domain} />
        </div>

        {/* Action bar */}
        <div className="flex flex-shrink-0 items-center gap-2 border-t border-surface-3 px-4 py-3">
          <button
            onClick={() => setTriggerExport("clipboard")}
            className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover"
          >
            Export Selected
          </button>
          <button
            onClick={handleExclude}
            className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Mark Excluded
          </button>
        </div>
      </div>
    </div>
  );
}
