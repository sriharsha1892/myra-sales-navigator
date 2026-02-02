"use client";

import { AdminSection } from "../AdminSection";

interface HeatmapData {
  verticals: Record<string, number>;
  regions: Record<string, number>;
}

function HeatmapGrid({
  label,
  items,
}: {
  label: string;
  items: [string, number][];
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-text-tertiary">
          {label}
        </p>
        <p className="text-xs text-text-tertiary">No data yet.</p>
      </div>
    );
  }

  const max = Math.max(...items.map(([, v]) => v), 1);

  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map(([name, count]) => {
          const intensity = Math.round((count / max) * 100);
          return (
            <div
              key={name}
              className="rounded-input border border-surface-3 px-2.5 py-1.5"
              style={{
                backgroundColor: `rgba(212, 160, 18, ${Math.max(0.08, intensity / 100 * 0.4)})`,
              }}
            >
              <span className="text-xs text-text-primary">{name}</span>
              <span className="ml-1.5 font-mono text-[10px] text-text-tertiary">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FilterHeatmap({ data }: { data: HeatmapData | null }) {
  if (!data) {
    return (
      <AdminSection title="Search Filter Patterns">
        <div className="shimmer h-32 rounded-card" />
      </AdminSection>
    );
  }

  const sortedVerticals = Object.entries(data.verticals).sort(
    ([, a], [, b]) => b - a
  );
  const sortedRegions = Object.entries(data.regions).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <AdminSection title="Search Filter Patterns">
      <div className="space-y-5">
        <HeatmapGrid label="Top Verticals" items={sortedVerticals} />
        <HeatmapGrid label="Top Regions" items={sortedRegions} />
      </div>
    </AdminSection>
  );
}
