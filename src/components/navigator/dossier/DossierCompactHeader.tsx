"use client";

import { useMemo, useState } from "react";
import type { CompanyEnriched } from "@/lib/navigator/types";
import { CompanyStatusBadge } from "./CompanyStatusBadge";
import { IcpScoreBadge } from "@/components/navigator/badges";
import { formatTimeAgo } from "@/components/navigator/shared/StalenessIndicator";

interface DossierCompactHeaderProps {
  company: CompanyEnriched;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function DossierCompactHeader({ company, onRefresh, isRefreshing }: DossierCompactHeaderProps) {
  const [mountTime] = useState(() => Date.now());

  const fsBanner = useMemo(() => {
    if (!company.freshsalesStatus || company.freshsalesStatus === "none") return null;
    const statusText = company.freshsalesStatus === "won" || company.freshsalesStatus === "customer"
      ? "Existing customer"
      : company.freshsalesStatus === "lost"
        ? "Previously lost"
        : `In CRM as ${company.freshsalesStatus.replace("_", " ")}`;
    const owner = company.freshsalesIntel?.account?.owner ?? null;
    const lastAct = company.freshsalesIntel?.recentActivity?.[0] ?? null;
    const actDaysAgo = lastAct?.date
      ? Math.floor((mountTime - new Date(lastAct.date).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const stalledDeal = company.freshsalesIntel?.deals?.find((d) => {
      if (d.stage?.toLowerCase() === "won" || d.stage?.toLowerCase() === "lost" || d.stage?.toLowerCase() === "closed") return false;
      return (d.daysInStage ?? 0) > 30 || (d.expectedClose && new Date(d.expectedClose) < new Date());
    }) ?? null;
    const colorClass = company.freshsalesStatus === "won" || company.freshsalesStatus === "customer"
      ? "bg-success/10 text-success"
      : company.freshsalesStatus === "lost"
        ? "bg-danger/10 text-danger"
        : "bg-warning/10 text-warning";
    return { statusText, owner, lastAct, actDaysAgo, colorClass, stalledDeal };
  }, [company.freshsalesStatus, company.freshsalesIntel, mountTime]);

  return (
    <div className="flex-shrink-0 border-b border-surface-3 px-4 py-3">
      {/* Line 1: Name + ICP badge + status */}
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 truncate font-display text-lg text-text-primary">
          {company.name}
        </h2>
        <IcpScoreBadge score={company.icpScore} breakdown={company.icpBreakdown} showBreakdown />
        <CompanyStatusBadge domain={company.domain} currentStatus={company.status ?? "new"} size="sm" />
      </div>
      {/* Line 2: Domain + staleness + refresh */}
      <div className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
        <span className="font-mono">{company.domain}</span>
        <span>·</span>
        <span>{formatTimeAgo(company.lastRefreshed)}</span>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="ml-1 transition-colors hover:text-text-secondary disabled:opacity-40"
          aria-label="Refresh"
        >
          <span className={isRefreshing ? "inline-block animate-spin" : ""}>&#x21bb;</span>
        </button>
      </div>
      {/* CRM alert banner (conditional) */}
      {fsBanner && (
        <div className={`mt-2 rounded-input px-3 py-1.5 text-[11px] font-medium ${fsBanner.colorClass}`}>
          {fsBanner.statusText}
          {fsBanner.owner && (
            <> &middot; Owned by <span className="text-accent-secondary">{fsBanner.owner.name}</span></>
          )}
          {fsBanner.lastAct && fsBanner.actDaysAgo != null && (
            <> &middot; Last touched {fsBanner.actDaysAgo === 0 ? "today" : `${fsBanner.actDaysAgo}d ago`}</>
          )}
          {fsBanner.stalledDeal && (
            <span className="ml-1 rounded-pill bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              Deal stalled &middot; {fsBanner.stalledDeal.daysInStage}d in {fsBanner.stalledDeal.stage}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
