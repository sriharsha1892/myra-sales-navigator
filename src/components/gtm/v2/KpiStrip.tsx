"use client";

import { useMemo } from "react";
import { DeltaBadge } from "./DeltaBadge";
import { HoverTooltip } from "@/components/gtm-dashboard/HoverTooltip";
import type { GtmEntry } from "@/lib/gtm/v2-types";

interface KpiStripProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

export function KpiStrip({ latest, previous }: KpiStripProps) {
  const stats = useMemo(() => {
    const snap = latest.orgSnapshot;
    const prevSnap = previous?.orgSnapshot;

    const paying = snap?.counts?.paying ?? 0;
    const prospects = snap?.counts?.prospect ?? 0;
    const trials = snap?.counts?.trial ?? 0;

    return {
      paying: {
        count: paying,
        prev: prevSnap?.counts?.paying ?? 0,
        names: snap?.names?.paying ?? [],
      },
      prospects: {
        count: prospects,
        prev: prevSnap?.counts?.prospect ?? 0,
        names: snap?.names?.prospect ?? [],
      },
      activeEngagement: {
        count: paying + prospects + trials,
        prev:
          (prevSnap?.counts?.paying ?? 0) +
          (prevSnap?.counts?.prospect ?? 0) +
          (prevSnap?.counts?.trial ?? 0),
        names: [
          ...(snap?.names?.paying ?? []).map((n: string) => `${n} (Paying)`),
          ...(snap?.names?.prospect ?? []).map((n: string) => `${n} (Prospect)`),
          ...(snap?.names?.trial ?? []).map((n: string) => `${n} (Trial)`),
        ],
      },
    };
  }, [latest, previous]);

  const cards = [
    {
      label: "Paying Customers",
      value: stats.paying.count,
      prev: stats.paying.prev,
      color: "text-emerald-600",
      gradient: "from-emerald-50 to-emerald-100/50",
      names: stats.paying.names,
    },
    {
      label: "Strong Prospects",
      value: stats.prospects.count,
      prev: stats.prospects.prev,
      color: "text-blue-600",
      gradient: "from-blue-50 to-blue-100/50",
      names: stats.prospects.names,
    },
    {
      label: "Active Engagement",
      value: stats.activeEngagement.count,
      prev: stats.activeEngagement.prev,
      color: "text-purple-600",
      gradient: "from-purple-50 to-purple-100/50",
      names: stats.activeEngagement.names,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <HoverTooltip
          key={card.label}
          content={
            card.names.length > 0
              ? card.names.join("\n")
              : "No organizations"
          }
        >
          <div
            className={`bg-gradient-to-br ${card.gradient} rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 cursor-default transition-all duration-[180ms] ease-out hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]`}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-semibold font-mono tabular-nums ${card.color}`}>
                {card.value}
              </span>
              <DeltaBadge current={card.value} previous={card.prev} />
            </div>
          </div>
        </HoverTooltip>
      ))}
    </div>
  );
}
