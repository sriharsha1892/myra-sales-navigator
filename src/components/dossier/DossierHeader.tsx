"use client";

import { useState } from "react";
import type { CompanyEnriched } from "@/lib/types";
import { IcpScoreBadge, SourceBadge } from "@/components/badges";
import { StalenessIndicator } from "@/components/shared/StalenessIndicator";
import { CompanyStatusBadge } from "./CompanyStatusBadge";
import { useStore } from "@/lib/store";

interface DossierHeaderProps {
  company: CompanyEnriched;
  onRefresh?: () => void;
}

export function DossierHeader({ company, onRefresh }: DossierHeaderProps) {
  const searchSimilar = useStore((s) => s.searchSimilar);
  const [regenerating, setRegenerating] = useState(false);
  const [localSummary, setLocalSummary] = useState<string | null>(null);

  const displaySummary = localSummary ?? company.aiSummary;

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/company/${encodeURIComponent(company.domain)}?regenerateSummary=true`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.aiSummary) {
          setLocalSummary(data.aiSummary);
        }
      }
    } catch { /* silent */ }
    setRegenerating(false);
  };

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
        <IcpScoreBadge score={company.icpScore} />
      </div>
      {displaySummary ? (
        <div className="mt-2">
          <p className="text-xs leading-relaxed text-text-secondary whitespace-pre-line">
            {displaySummary}
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="mt-1 text-[10px] text-text-tertiary hover:text-accent-primary disabled:opacity-50"
          >
            {regenerating ? "Regenerating..." : "\u21bb Regenerate"}
          </button>
        </div>
      ) : regenerating ? (
        <div className="mt-2 shimmer h-12 rounded" />
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-0.5">
          {(Array.isArray(company.sources) ? company.sources : []).map((src) => (
            <SourceBadge key={src} source={src} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <StalenessIndicator
          lastRefreshed={company.lastRefreshed}
          onRefresh={onRefresh ?? (() => {})}
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
