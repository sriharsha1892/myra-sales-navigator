"use client";

import type { CompanyEnriched } from "@/lib/types";
import { MissingData } from "@/components/shared/MissingData";
import { HighlightTerms } from "@/components/shared/HighlightTerms";
import { useStore } from "@/lib/store";
import { pick } from "@/lib/ui-copy";

interface DossierOverviewProps {
  company: CompanyEnriched;
}

export function DossierOverview({ company }: DossierOverviewProps) {
  const lastSearchQuery = useStore((s) => s.lastSearchQuery);

  return (
    <div className="space-y-3 rounded-card bg-surface-0/50 px-4 py-3">
      <SectionTitle>Overview</SectionTitle>
      <p className="text-xs leading-relaxed text-text-secondary">
        <HighlightTerms text={company.description} query={lastSearchQuery} />
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Industry" value={company.industry} />
        <Field label="Vertical" value={company.vertical} />
        <Field label="Employees" value={company.employeeCount ? company.employeeCount.toLocaleString("en-US") : undefined} />
        <Field label="Location" value={company.location} />
        <Field label="Region" value={company.region} />
        <Field label="Revenue" value={company.revenue} />
        <Field label="Founded" value={company.founded} />
        <Field label="Phone" value={company.phone} missingLabel="No phone available" />
      </div>

      {/* ICP Fit Breakdown */}
      {company.icpBreakdown && company.icpBreakdown.length > 0 && (
        <div>
          <SectionTitle>ICP Fit</SectionTitle>
          <div className="mt-1.5 space-y-1">
            {company.icpBreakdown.map((item) => {
              const color = item.points > 0
                ? "text-success"
                : item.points < 0
                ? "text-danger"
                : "text-text-tertiary";
              const sign = item.points > 0 ? "+" : "";
              return (
                <div key={item.factor} className="flex items-center justify-between text-xs">
                  <span className={item.matched ? "text-text-secondary" : "text-text-tertiary"}>
                    {item.factor}
                  </span>
                  <span className={`font-mono text-[10px] ${color}`}>
                    {item.points === 0 ? "—" : `${sign}${item.points}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
      {children}
    </h3>
  );
}

function Field({
  label,
  value,
  missingLabel,
}: {
  label: string;
  value?: string | null;
  missingLabel?: string;
}) {
  return (
    <div>
      <span className="block text-[10px] text-text-tertiary">{label}</span>
      {value ? (
        <span className="text-xs text-text-primary">{value}</span>
      ) : (
        <MissingData label={missingLabel ?? pick("missing_data")} />
      )}
    </div>
  );
}
