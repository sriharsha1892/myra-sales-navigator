"use client";

import { AdminSection } from "../AdminSection";

interface SourceStats {
  source: string;
  companies: number;
  avgIcp: number;
  contacts: number;
  extractionRate: number;
}

const SOURCE_LABELS: Record<string, string> = {
  exa: "Exa",
  apollo: "Apollo",
  hubspot: "HubSpot",
};

export function SourcePerformance({ data }: { data: SourceStats[] | null }) {
  if (!data) {
    return (
      <AdminSection title="Source Performance">
        <div className="shimmer h-32 rounded-card" />
      </AdminSection>
    );
  }

  if (data.length === 0) {
    return (
      <AdminSection title="Source Performance">
        <p className="text-xs text-text-tertiary">No source data available yet.</p>
      </AdminSection>
    );
  }

  const maxCompanies = Math.max(...data.map((d) => d.companies), 1);

  return (
    <AdminSection title="Source Performance">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-3 text-left text-[10px] uppercase text-text-tertiary">
              <th className="pb-2 pr-3">Source</th>
              <th className="pb-2 pr-3">Companies</th>
              <th className="pb-2 pr-3">Avg ICP</th>
              <th className="pb-2 pr-3">Contacts</th>
              <th className="pb-2">Extraction Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.source} className="border-b border-surface-3/50">
                <td className="py-1.5 pr-3 text-text-primary">
                  {SOURCE_LABELS[s.source] ?? s.source}
                </td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text-secondary">
                      {s.companies}
                    </span>
                    <div className="h-1.5 w-16 rounded-full bg-surface-3">
                      <div
                        className="h-1.5 rounded-full bg-accent-secondary transition-all duration-300"
                        style={{
                          width: `${Math.round((s.companies / maxCompanies) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-1.5 pr-3 font-mono text-text-secondary">
                  {s.avgIcp}
                </td>
                <td className="py-1.5 pr-3 font-mono text-text-secondary">
                  {s.contacts}
                </td>
                <td className="py-1.5 font-mono text-text-secondary">
                  {s.extractionRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
