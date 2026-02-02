"use client";

import type { CompanyEnriched } from "@/lib/types";
import { IcpScoreBadge, SourceBadge } from "@/components/badges";
import { StalenessIndicator } from "@/components/shared/StalenessIndicator";

interface DossierHeaderProps {
  company: CompanyEnriched;
  onRefresh?: () => void;
}

export function DossierHeader({ company, onRefresh }: DossierHeaderProps) {
  return (
    <div className="border-b border-surface-3 px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-text-primary">
            {company.name}
          </h2>
          <p className="font-mono text-xs text-text-tertiary">{company.domain}</p>
        </div>
        <IcpScoreBadge score={company.icpScore} />
      </div>
      {company.aiSummary && (
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          {company.aiSummary}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-0.5">
          {company.sources.map((src) => (
            <SourceBadge key={src} source={src} />
          ))}
        </div>
      </div>
      <div className="mt-2">
        <StalenessIndicator
          lastRefreshed={company.lastRefreshed}
          onRefresh={onRefresh ?? (() => {})}
        />
      </div>
    </div>
  );
}
