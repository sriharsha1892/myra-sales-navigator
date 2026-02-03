"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/gtm-dashboard/GlassCard";
import { DeltaBadge } from "@/components/gtm-dashboard/DeltaBadge";
import { HoverTooltip } from "@/components/gtm-dashboard/HoverTooltip";
import type { GtmOrganization, GtmSnapshot } from "@/lib/gtm-dashboard/types";

interface KpiStripProps {
  organizations: GtmOrganization[];
  previousSnapshot: GtmSnapshot | null;
  loading?: boolean;
}

export function KpiStrip({ organizations, previousSnapshot, loading }: KpiStripProps) {
  const stats = useMemo(() => {
    const paying = organizations.filter((o) => o.segment === "Paying");
    const prospects = organizations.filter(
      (o) => o.segment === "Strong Prospect"
    );
    const trials = organizations.filter((o) => o.segment === "Active Trial");
    const activeEngagement = prospects.length + trials.length;

    const prev = previousSnapshot?.snapshotData?.segments;

    return {
      paying: {
        count: paying.length,
        prev: prev?.Paying?.count ?? 0,
        names: paying.map((o) => o.name),
      },
      prospects: {
        count: prospects.length,
        prev: prev?.["Strong Prospect"]?.count ?? 0,
        names: prospects.map((o) => o.name),
      },
      activeEngagement: {
        count: activeEngagement,
        prev:
          (prev?.["Strong Prospect"]?.count ?? 0) +
          (prev?.["Active Trial"]?.count ?? 0),
        names: [...prospects, ...trials].map((o) => `${o.name} (${o.segment})`),
      },
    };
  }, [organizations, previousSnapshot]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <GlassCard key={i}>
            <div className="shimmer h-3 w-24 rounded mb-3" />
            <div className="shimmer h-8 w-16 rounded" />
          </GlassCard>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Paying",
      value: stats.paying.count,
      prev: stats.paying.prev,
      color: "text-emerald-600",
      names: stats.paying.names,
    },
    {
      label: "Strong Prospects",
      value: stats.prospects.count,
      prev: stats.prospects.prev,
      color: "text-blue-600",
      names: stats.prospects.names,
    },
    {
      label: "Active Engagement",
      value: stats.activeEngagement.count,
      prev: stats.activeEngagement.prev,
      color: "text-purple-600",
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
          <GlassCard className="cursor-default">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-semibold ${card.color}`}>
                {card.value}
              </span>
              <DeltaBadge current={card.value} previous={card.prev} />
            </div>
          </GlassCard>
        </HoverTooltip>
      ))}
    </div>
  );
}
