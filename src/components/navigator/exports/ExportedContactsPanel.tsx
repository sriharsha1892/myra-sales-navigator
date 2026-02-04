"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";

interface ExportedContact {
  id: string;
  contact_email: string;
  contact_name: string;
  company_domain: string;
  exported_by: string;
  export_format: string;
  exported_at: string;
}

interface GroupedExport {
  domain: string;
  contacts: ExportedContact[];
  latestExport: string;
  exportedBy: string;
}

function getFollowUpStatus(exportedAt: string): { label: string; color: string } {
  const daysSince = (Date.now() - new Date(exportedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 3) return { label: "Fresh", color: "bg-emerald-500/15 text-emerald-400" };
  if (daysSince <= 7) return { label: "Follow up", color: "bg-amber-500/15 text-amber-400" };
  return { label: "Stale", color: "bg-red-500/15 text-red-400" };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ExportedContactsPanel() {
  const userName = useStore((s) => s.userName);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "all">("30d");

  const { data, isLoading } = useQuery({
    queryKey: ["exported-contacts", userName, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userName) params.set("user", userName);
      const now = Date.now();
      if (dateRange === "7d") params.set("since", new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());
      else if (dateRange === "30d") params.set("since", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());
      const res = await fetch(`/api/contact/export-history?${params}`);
      if (!res.ok) return { exports: [] };
      return res.json() as Promise<{ exports: ExportedContact[] }>;
    },
    staleTime: 60_000,
  });

  const exports = data?.exports ?? [];

  // Group by company domain
  const grouped: GroupedExport[] = [];
  const domainMap = new Map<string, ExportedContact[]>();
  for (const exp of exports) {
    const list = domainMap.get(exp.company_domain) ?? [];
    list.push(exp);
    domainMap.set(exp.company_domain, list);
  }
  for (const [domain, contacts] of domainMap) {
    const sorted = [...contacts].sort(
      (a, b) => new Date(b.exported_at).getTime() - new Date(a.exported_at).getTime()
    );
    grouped.push({
      domain,
      contacts: sorted,
      latestExport: sorted[0].exported_at,
      exportedBy: sorted[0].exported_by,
    });
  }
  grouped.sort((a, b) => new Date(b.latestExport).getTime() - new Date(a.latestExport).getTime());

  const totalContacts = exports.length;
  const totalCompanies = grouped.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Recent Exports</h3>
        <div className="flex gap-1">
          {(["7d", "30d", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`rounded-pill px-2.5 py-1 text-xs transition-colors ${
                dateRange === range
                  ? "bg-accent-primary/15 text-accent-primary font-medium"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {range === "all" ? "All" : range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {!isLoading && totalContacts > 0 && (
        <p className="text-xs text-text-tertiary">
          {totalContacts} contact{totalContacts !== 1 ? "s" : ""} exported across{" "}
          {totalCompanies} compan{totalCompanies !== 1 ? "ies" : "y"}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer h-16 rounded-card" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && exports.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-sm text-text-secondary">No exports found</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Export contacts from a company dossier to see them here.
          </p>
        </div>
      )}

      {/* Grouped exports */}
      {!isLoading &&
        grouped.map((group) => {
          const status = getFollowUpStatus(group.latestExport);
          return (
            <div
              key={group.domain}
              className="rounded-card border border-surface-3 bg-surface-1 animate-fadeInUp"
            >
              {/* Company header */}
              <div className="flex items-center justify-between border-b border-surface-3 px-3 py-2">
                <div>
                  <span className="text-xs font-medium text-text-primary">{group.domain}</span>
                  <span className="ml-2 text-xs text-text-tertiary">
                    {formatDate(group.latestExport)} by {group.exportedBy}
                  </span>
                </div>
                <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>

              {/* Contact rows */}
              <div className="px-3 py-1.5">
                {group.contacts.map((c) => (
                  <div key={c.id ?? `${c.contact_email}-${c.exported_at}`} className="flex items-center gap-3 py-1 text-xs">
                    <span className="text-text-primary">{c.contact_name || "—"}</span>
                    <span className="font-mono text-text-tertiary">{c.contact_email || "—"}</span>
                    <span className="ml-auto text-xs text-text-tertiary">
                      {c.export_format}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
