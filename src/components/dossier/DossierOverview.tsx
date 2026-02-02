"use client";

import type { CompanyEnriched } from "@/lib/types";
import { MissingData } from "@/components/shared/MissingData";

interface DossierOverviewProps {
  company: CompanyEnriched;
}

export function DossierOverview({ company }: DossierOverviewProps) {
  return (
    <div className="space-y-3 px-4 py-3">
      <SectionTitle>Overview</SectionTitle>
      <p className="text-xs leading-relaxed text-text-secondary">
        {company.description}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Industry" value={company.industry} />
        <Field label="Vertical" value={company.vertical} />
        <Field label="Employees" value={company.employeeCount.toLocaleString("en-US")} />
        <Field label="Location" value={company.location} />
        <Field label="Region" value={company.region} />
        <Field label="Revenue" value={company.revenue} />
        <Field label="Founded" value={company.founded} />
        <Field label="Phone" value={company.phone} missingLabel="No phone available" />
      </div>
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
        <MissingData label={missingLabel ?? `No ${label.toLowerCase()} available`} />
      )}
    </div>
  );
}
