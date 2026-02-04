"use client";

import type { CompanyEnriched } from "@/lib/navigator/types";
import { IcpScoreBadge, SourceBadge } from "@/components/navigator/badges";
import { StalenessIndicator } from "@/components/navigator/shared/StalenessIndicator";
import { CompanyStatusBadge } from "./CompanyStatusBadge";
import { RecommendedActionBar } from "./RecommendedActionBar";
import { useStore } from "@/lib/navigator/store";

interface DossierHeaderProps {
  company: CompanyEnriched;
  onRefresh?: () => void;
}

export function DossierHeader({ company, onRefresh }: DossierHeaderProps) {
  const searchSimilar = useStore((s) => s.searchSimilar);
  const contacts = useStore((s) => s.contactsByDomain[company.domain] ?? []);

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
      {company.description && (
        <div className="mt-2">
          <p className="text-xs leading-relaxed text-text-secondary whitespace-pre-line">
            {company.description}
          </p>
        </div>
      )}
      <RecommendedActionBar company={company} contacts={contacts} />
      {company.freshsalesStatus && company.freshsalesStatus !== "none" && (
        <div
          className={`mt-2 rounded-input px-3 py-1.5 text-[11px] font-medium ${
            company.freshsalesStatus === "won" || company.freshsalesStatus === "customer"
              ? "bg-emerald-500/10 text-emerald-400"
              : company.freshsalesStatus === "lost"
                ? "bg-red-500/10 text-red-400"
                : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {company.freshsalesStatus === "won" || company.freshsalesStatus === "customer"
            ? "Existing customer in Freshsales."
            : company.freshsalesStatus === "lost"
              ? "Previously lost in Freshsales."
              : `This company is in Freshsales as ${company.freshsalesStatus.replace("_", " ")}. Check CRM section below.`}
        </div>
      )}
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
