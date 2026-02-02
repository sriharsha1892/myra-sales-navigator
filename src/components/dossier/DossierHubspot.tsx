"use client";

import type { CompanyEnriched } from "@/lib/types";
import { MissingData } from "@/components/shared/MissingData";

interface DossierHubspotProps {
  company: CompanyEnriched;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "text-accent-primary" },
  open: { label: "Open", color: "text-warning" },
  in_progress: { label: "In Progress", color: "text-warning" },
  closed_won: { label: "Closed Won", color: "text-success" },
  closed_lost: { label: "Closed Lost", color: "text-accent-highlight" },
  none: { label: "Not in HubSpot", color: "text-text-tertiary" },
};

export function DossierHubspot({ company }: DossierHubspotProps) {
  const status = statusLabels[company.hubspotStatus] ?? statusLabels.none;

  return (
    <div className="px-4 py-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        HubSpot
      </h3>
      <div className="space-y-2">
        <div>
          <span className="block text-[10px] text-text-tertiary">Status</span>
          <span className={`text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>
        {company.hubspotStatus === "none" ? (
          <MissingData label="No HubSpot data available" />
        ) : (
          <>
            <div>
              <span className="block text-[10px] text-text-tertiary">Last Contact</span>
              <span className="text-xs text-text-secondary">
                {new Date(company.lastRefreshed).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-text-tertiary">Deal Stage</span>
              <span className="text-xs text-text-secondary">
                {company.hubspotStatus === "closed_won"
                  ? "Customer"
                  : company.hubspotStatus === "in_progress"
                    ? "Negotiation"
                    : "Discovery"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
