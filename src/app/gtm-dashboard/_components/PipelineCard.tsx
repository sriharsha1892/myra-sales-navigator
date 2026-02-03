"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/gtm-dashboard/GlassCard";
import { DeltaBadge } from "@/components/gtm-dashboard/DeltaBadge";
import { HoverTooltip } from "@/components/gtm-dashboard/HoverTooltip";
import type { GtmOrganization, GtmSnapshot, Segment } from "@/lib/gtm-dashboard/types";

interface PipelineCardProps {
  organizations: GtmOrganization[];
  previousSnapshot: GtmSnapshot | null;
  loading?: boolean;
}

interface SegmentRow {
  label: string;
  segment: Segment;
  count: number;
  prev: number;
  names: string[];
}

const SECTIONS: { title: string; segments: Segment[] }[] = [
  {
    title: "Product Engagement",
    segments: ["Active Trial"],
  },
  {
    title: "Sales Pipeline",
    segments: ["Post-Demo", "Demo Queued"],
  },
  {
    title: "Inactive",
    segments: ["Dormant", "Lost", "Early/No Info"],
  },
];

export function PipelineCard({
  organizations,
  previousSnapshot,
  loading,
}: PipelineCardProps) {
  const segmentData = useMemo(() => {
    const bySegment: Record<string, GtmOrganization[]> = {};
    organizations.forEach((o) => {
      if (!bySegment[o.segment]) bySegment[o.segment] = [];
      bySegment[o.segment].push(o);
    });

    const prev = previousSnapshot?.snapshotData?.segments ?? {};

    return SECTIONS.map((section) => ({
      title: section.title,
      rows: section.segments.map(
        (seg): SegmentRow => ({
          label: seg,
          segment: seg,
          count: (bySegment[seg] ?? []).length,
          prev: prev[seg]?.count ?? 0,
          names: (bySegment[seg] ?? []).map((o) => o.name),
        })
      ),
    }));
  }, [organizations, previousSnapshot]);

  if (loading) {
    return (
      <GlassCard>
        <div className="shimmer h-4 w-20 rounded mb-4" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="shimmer h-3 w-28 rounded" />
              <div className="shimmer h-3 w-8 rounded" />
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline</h3>
      <div className="space-y-5">
        {segmentData.map((section) => (
          <div key={section.title}>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              {section.title}
            </p>
            <div className="space-y-1.5">
              {section.rows.map((row) => (
                <HoverTooltip
                  key={row.segment}
                  content={
                    row.names.length > 0
                      ? row.names.join("\n")
                      : "No organizations"
                  }
                >
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50/80 transition-colors cursor-default">
                    <span className="text-sm text-gray-700">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">
                        {row.count}
                      </span>
                      <DeltaBadge current={row.count} previous={row.prev} />
                    </div>
                  </div>
                </HoverTooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
