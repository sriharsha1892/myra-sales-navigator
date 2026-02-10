"use client";

import { useState, useEffect } from "react";
import { AdminSection } from "./AdminSection";
import { timeAgo } from "@/lib/utils";
import { pick } from "@/lib/navigator/ui-copy";

interface UserSummary {
  name: string;
  searches: number;
  companiesViewed: number;
  exports: number;
  contactsExported: number;
  lastActive: string;
}

interface TimelineEntry {
  type: string;
  text: string;
  at: string;
}

export function UserActivitySection() {
  const [summary, setSummary] = useState<UserSummary[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return { from, to };
  });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      from: dateRange.from,
      to: dateRange.to,
      ...(selectedUser ? { user: selectedUser } : {}),
    });
    const controller = new AbortController();
    fetch(`/api/admin/user-activity?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setSummary(data.summary ?? []);
          setTimeline(data.timeline ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, [dateRange, selectedUser]);

  return (
    <AdminSection
      title="User Activity"
      description="Per-user activity breakdown. Click a user to drill into their timeline."
    >
      {/* Date range */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs text-text-tertiary">From</label>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
          className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary"
        />
        <label className="text-xs text-text-tertiary">To</label>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
          className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary"
        />
        {selectedUser && (
          <button
            onClick={() => setSelectedUser(null)}
            className="text-xs text-accent-secondary hover:underline"
          >
            &larr; All users
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      ) : selectedUser ? (
        /* Timeline drill-down */
        <div className="space-y-1.5">
          <h3 className="mb-2 text-xs font-medium text-text-primary">{selectedUser}&apos;s Activity</h3>
          {timeline.length === 0 ? (
            <p className="text-xs text-text-tertiary">{pick("empty_activity")}</p>
          ) : (
            timeline.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 py-1">
                <span className={`mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                  entry.type === "search" ? "bg-accent-secondary" : entry.type === "export" ? "bg-success" : "bg-accent-primary"
                }`} />
                <span className="flex-1 text-xs text-text-secondary">{entry.text}</span>
                <span className="flex-shrink-0 text-xs text-text-tertiary">{timeAgo(entry.at)}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Summary table */
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-3 text-left text-xs text-text-tertiary">
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Searches</th>
                <th className="pb-2 pr-4">Viewed</th>
                <th className="pb-2 pr-4">Exports</th>
                <th className="pb-2 pr-4">Contacts</th>
                <th className="pb-2">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((u) => (
                <tr
                  key={u.name}
                  onClick={() => setSelectedUser(u.name)}
                  className="cursor-pointer border-b border-surface-3/50 transition-colors hover:bg-surface-2"
                >
                  <td className="py-1.5 pr-4 font-medium text-text-primary">{u.name}</td>
                  <td className="py-1.5 pr-4 font-mono text-text-secondary">{u.searches}</td>
                  <td className="py-1.5 pr-4 font-mono text-text-secondary">{u.companiesViewed}</td>
                  <td className="py-1.5 pr-4 font-mono text-text-secondary">{u.exports}</td>
                  <td className="py-1.5 pr-4 font-mono text-text-secondary">{u.contactsExported}</td>
                  <td className="py-1.5 text-text-tertiary">{u.lastActive ? timeAgo(u.lastActive) : "—"}</td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-text-tertiary">{pick("empty_activity")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminSection>
  );
}
