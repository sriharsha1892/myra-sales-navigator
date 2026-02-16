"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { FreshsalesIntel } from "@/lib/navigator/types";

interface DealHealthSummaryProps {
  intel: FreshsalesIntel;
  stalledThresholdDays?: number;
}

type DealHealth = "healthy" | "at_risk" | "stalled";

function assessDealHealth(deal: FreshsalesIntel["deals"][number], stalledThreshold: number): DealHealth {
  const overdue = deal.expectedClose && new Date(deal.expectedClose) < new Date();
  const stalled = (deal.daysInStage ?? 0) > stalledThreshold;
  if (overdue || stalled) return "stalled";
  if ((deal.probability ?? 0) < 50) return "at_risk";
  return "healthy";
}

const healthConfig: Record<DealHealth, { label: string; color: string; bg: string }> = {
  healthy: { label: "On Track", color: "text-success", bg: "bg-success/10" },
  at_risk: { label: "At Risk", color: "text-danger", bg: "bg-danger/10" },
  stalled: { label: "Stalled", color: "text-warning", bg: "bg-warning/10" },
};

function formatCurrency(amount: number | null): string {
  if (!amount) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function DealHealthSummary({ intel, stalledThresholdDays = 30 }: DealHealthSummaryProps) {
  const topDeal = useMemo(() => {
    const openDeals = (intel.deals ?? []).filter(
      (d) => d.stage?.toLowerCase() !== "won" && d.stage?.toLowerCase() !== "lost" && d.stage?.toLowerCase() !== "closed"
    );
    if (openDeals.length === 0) return null;
    return openDeals.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))[0];
  }, [intel.deals]);

  if (!topDeal) return null;

  const health = assessDealHealth(topDeal, stalledThresholdDays);
  const config = healthConfig[health];

  return (
    <div className={cn("mb-3 rounded-input border px-3 py-2", health === "stalled" ? "border-warning/20" : health === "at_risk" ? "border-danger/20" : "border-success/20")}>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-pill px-1.5 py-0.5 text-[10px] font-medium", config.color, config.bg)}>
          {config.label}
        </span>
        <span className="truncate text-xs font-medium text-text-primary">{topDeal.name}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-text-tertiary">
        <span>{topDeal.stage}</span>
        {topDeal.probability != null && (
          <span className="font-mono">{topDeal.probability}%</span>
        )}
        {topDeal.amount != null && (
          <span className="font-mono">{formatCurrency(topDeal.amount)}</span>
        )}
        {topDeal.expectedClose && (
          <span>Close {new Date(topDeal.expectedClose).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        )}
        {topDeal.daysInStage != null && (
          <span className={cn("font-mono", topDeal.daysInStage > stalledThresholdDays ? "text-warning" : "")}>
            {topDeal.daysInStage}d in stage
          </span>
        )}
      </div>
    </div>
  );
}
