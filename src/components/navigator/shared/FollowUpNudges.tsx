"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";

interface ExportEntry {
  company_domain: string;
  exported_at: string;
  contact_name: string;
}

interface NudgeGroup {
  domain: string;
  count: number;
  daysAgo: number;
}

function computeDateRange() {
  const now = Date.now();
  return {
    since: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
    until: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    referenceNow: now,
  };
}

function groupExports(exports: ExportEntry[], referenceNow: number) {
  const domainMap = new Map<string, ExportEntry[]>();
  for (const exp of exports) {
    const list = domainMap.get(exp.company_domain) ?? [];
    list.push(exp);
    domainMap.set(exp.company_domain, list);
  }

  const nudges: NudgeGroup[] = [];
  for (const [domain, entries] of domainMap) {
    const latest = entries.reduce(
      (max, e) => (new Date(e.exported_at) > new Date(max) ? e.exported_at : max),
      entries[0].exported_at
    );
    const daysAgo = Math.floor(
      (referenceNow - new Date(latest).getTime()) / (1000 * 60 * 60 * 24)
    );
    nudges.push({ domain, count: entries.length, daysAgo });
  }
  nudges.sort((a, b) => b.daysAgo - a.daysAgo);
  return nudges;
}

export function FollowUpNudges() {
  const userName = useStore((s) => s.userName);
  const dismissed = useStore((s) => s.followUpNudgesDismissed);
  const dismiss = useStore((s) => s.dismissFollowUpNudges);
  const setViewMode = useStore((s) => s.setViewMode);

  // Compute dates once on mount (not during every render)
  const [dateRange] = useState(computeDateRange);

  const { data } = useQuery({
    queryKey: ["follow-up-nudges", userName, dateRange.since, dateRange.until],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userName) params.set("user", userName);
      params.set("since", dateRange.since);
      params.set("until", dateRange.until);
      const res = await fetch(`/api/contact/export-history?${params}`);
      if (!res.ok) return { exports: [] };
      return res.json() as Promise<{ exports: ExportEntry[] }>;
    },
    staleTime: 300_000,
    enabled: !dismissed,
  });

  if (dismissed) return null;

  const exports = data?.exports ?? [];
  if (exports.length === 0) return null;

  const nudges = groupExports(exports, dateRange.referenceNow);
  const top3 = nudges.slice(0, 3);

  return (
    <div className="rounded-card border border-amber-500/20 bg-amber-500/5 px-4 py-3 animate-fadeInUp">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-amber-400">Follow-up needed</span>
        <button
          onClick={dismiss}
          className="text-xs text-text-tertiary hover:text-text-secondary"
        >
          Dismiss
        </button>
      </div>
      <div className="space-y-1">
        {top3.map((nudge) => (
          <p key={nudge.domain} className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">{nudge.domain}</span>
            {" — "}
            {nudge.count} contact{nudge.count !== 1 ? "s" : ""} exported {nudge.daysAgo}d ago
          </p>
        ))}
      </div>
      {nudges.length > 3 && (
        <button
          onClick={() => setViewMode("exported")}
          className="mt-2 text-xs text-accent-primary hover:underline"
        >
          View all exports &rarr;
        </button>
      )}
    </div>
  );
}
