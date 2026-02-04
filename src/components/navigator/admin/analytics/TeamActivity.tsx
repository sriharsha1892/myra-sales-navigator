"use client";

import { AdminSection } from "../AdminSection";

interface TeamMember {
  name: string;
  searches: number;
  exports: number;
  notes: number;
  companiesViewed: number;
  lastActive: string;
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function TeamActivity({ data }: { data: TeamMember[] | null }) {
  if (!data) {
    return (
      <AdminSection title="Team Activity">
        <div className="shimmer h-40 rounded-card" />
      </AdminSection>
    );
  }

  if (data.length === 0) {
    return (
      <AdminSection title="Team Activity">
        <p className="text-xs text-text-tertiary">No team activity data yet.</p>
      </AdminSection>
    );
  }

  return (
    <AdminSection title="Team Activity">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-3 text-left text-[10px] uppercase text-text-tertiary">
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Searches</th>
              <th className="pb-2 pr-3">Exports</th>
              <th className="pb-2 pr-3">Notes</th>
              <th className="pb-2 pr-3">Companies</th>
              <th className="pb-2">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.name} className="border-b border-surface-3/50">
                <td className="py-1.5 pr-3 text-text-primary">{m.name}</td>
                <td className="py-1.5 pr-3 font-mono text-text-secondary">
                  {m.searches}
                </td>
                <td className="py-1.5 pr-3 font-mono text-text-secondary">
                  {m.exports}
                </td>
                <td className="py-1.5 pr-3 font-mono text-text-secondary">
                  {m.notes}
                </td>
                <td className="py-1.5 pr-3 font-mono text-text-secondary">
                  {m.companiesViewed}
                </td>
                <td className="py-1.5 font-mono text-text-tertiary">
                  {relativeTime(m.lastActive)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
