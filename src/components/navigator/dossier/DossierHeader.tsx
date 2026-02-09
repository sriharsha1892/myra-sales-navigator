"use client";

import { useMemo, useState } from "react";
import type { CompanyEnriched } from "@/lib/navigator/types";
import { IcpScoreBadge, SourceBadge } from "@/components/navigator/badges";
import { StalenessIndicator } from "@/components/navigator/shared/StalenessIndicator";
import { CompanyStatusBadge } from "./CompanyStatusBadge";
import { RecommendedActionBar } from "./RecommendedActionBar";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import { useStore } from "@/lib/navigator/store";

interface DossierHeaderProps {
  company: CompanyEnriched;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const completenessFields: { key: keyof CompanyEnriched; label: string }[] = [
  { key: "industry", label: "Industry" },
  { key: "employeeCount", label: "Size" },
  { key: "revenue", label: "Revenue" },
  { key: "website", label: "Website" },
  { key: "description", label: "Description" },
  { key: "location", label: "Location" },
];

export function DossierHeader({ company, onRefresh, isRefreshing }: DossierHeaderProps) {
  const searchSimilar = useStore((s) => s.searchSimilar);
  const rawContacts = useStore((s) => s.contactsByDomain[company.domain]);
  const contacts = useMemo(() => rawContacts ?? [], [rawContacts]);

  // Capture time at mount — avoids impure Date.now() in render (react-hooks/purity)
  const [mountTime] = useState(() => Date.now());

  const fsBanner = useMemo(() => {
    if (!company.freshsalesStatus || company.freshsalesStatus === "none") return null;
    const statusText = company.freshsalesStatus === "won" || company.freshsalesStatus === "customer"
      ? "Existing customer in Freshsales"
      : company.freshsalesStatus === "lost"
        ? "Previously lost in Freshsales"
        : `In Freshsales as ${company.freshsalesStatus.replace("_", " ")}`;
    const owner = company.freshsalesIntel?.account?.owner ?? null;
    const lastAct = company.freshsalesIntel?.recentActivity?.[0] ?? null;
    const actDaysAgo = lastAct?.date
      ? Math.floor((mountTime - new Date(lastAct.date).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const colorClass = company.freshsalesStatus === "won" || company.freshsalesStatus === "customer"
      ? "bg-success/10 text-success"
      : company.freshsalesStatus === "lost"
        ? "bg-danger/10 text-danger"
        : "bg-warning/10 text-warning";
    return { statusText, owner, lastAct, actDaysAgo, colorClass };
  }, [company.freshsalesStatus, company.freshsalesIntel, mountTime]);

  const filled = completenessFields.filter((f) => {
    const v = company[f.key];
    return v !== undefined && v !== null && v !== "" && v !== 0;
  });
  const filledCount = filled.length;
  const totalFields = completenessFields.length;
  const missingLabels = completenessFields
    .filter((f) => !filled.includes(f))
    .map((f) => f.label);

  return (
    <div className="border-b border-surface-3 px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {company.name}
          </h2>
          <p className="font-mono text-xs text-text-tertiary">{company.domain}</p>
          <div className="mt-1">
            <CompanyStatusBadge domain={company.domain} currentStatus={company.status ?? "new"} />
          </div>
        </div>
        <IcpScoreBadge score={company.icpScore} breakdown={company.icpBreakdown} />
      </div>

      {/* Data completeness bar (C2) */}
      <Tooltip text={missingLabels.length > 0 ? `Missing: ${missingLabels.join(", ")}` : "All key fields populated"}>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-1.5 flex-1 gap-0.5">
            {completenessFields.map((f, i) => {
              const isFilled = filled.includes(f);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-colors ${
                    isFilled ? "bg-success/60" : "bg-surface-3"
                  }`}
                />
              );
            })}
          </div>
          <span className="font-mono text-[10px] text-text-tertiary">{filledCount}/{totalFields}</span>
        </div>
      </Tooltip>

      {company.description && (
        <div className="mt-2">
          <p className="text-xs leading-relaxed text-text-secondary whitespace-pre-line">
            {company.description}
          </p>
        </div>
      )}
      <RecommendedActionBar company={company} contacts={contacts} />
      {fsBanner && (
        <div className={`mt-2 rounded-input px-3 py-1.5 text-[11px] font-medium ${fsBanner.colorClass}`}>
          {fsBanner.statusText}
          {fsBanner.owner && (
            <> &middot; Owned by <span className="text-accent-secondary">{fsBanner.owner.name}</span></>
          )}
          {fsBanner.lastAct && fsBanner.actDaysAgo != null && (
            <> &middot; Last touched {fsBanner.actDaysAgo === 0 ? "today" : `${fsBanner.actDaysAgo}d ago`} ({fsBanner.lastAct.type})</>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        {/* Source badges with legend tooltip (C3) */}
        <Tooltip text="E = Exa (web intel) · A = Apollo (contacts) · H = HubSpot (CRM) · F = Freshsales (CRM)">
          <div className="flex gap-0.5">
            {(Array.isArray(company.sources) ? company.sources : []).map((src) => (
              <SourceBadge key={src} source={src} />
            ))}
          </div>
        </Tooltip>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <StalenessIndicator
          lastRefreshed={company.lastRefreshed}
          onRefresh={onRefresh ?? (() => {})}
          isRefreshing={isRefreshing}
        />
        <button
          onClick={() => searchSimilar(company)}
          className="rounded px-2 py-0.5 text-[10px] text-accent-primary transition-colors hover:bg-accent-primary-light"
        >
          Find similar
        </button>
      </div>
    </div>
  );
}
