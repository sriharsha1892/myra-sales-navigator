"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface RecentExport {
  domain: string;
  contactCount: number;
  daysAgo: number;
  status: "fresh" | "follow_up" | "stale";
}

const statusConfig: Record<string, { label: string; color: string }> = {
  fresh: { label: "Fresh", color: "bg-success/15 text-success" },
  follow_up: { label: "Follow up", color: "bg-warning/15 text-warning" },
  stale: { label: "Stale", color: "bg-danger/15 text-danger" },
};

export function RecentExportsWidget() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("nav_recent_exports_collapsed") === "1"
  );

  const { data, isLoading } = useQuery<{ exports: RecentExport[] }>({
    queryKey: ["recent-exports"],
    queryFn: async () => {
      const res = await fetch("/api/exports/recent");
      if (!res.ok) return { exports: [] };
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const exports = data?.exports ?? [];
  const needFollowUp = exports.filter((e) => e.status === "follow_up" || e.status === "stale").length;

  if (!isLoading && exports.length === 0) return null;

  return (
    <div className="rounded-card border border-surface-3 bg-surface-1">
      <button
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          localStorage.setItem("nav_recent_exports_collapsed", next ? "1" : "0");
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`text-text-tertiary transition-transform duration-[180ms] ${collapsed ? "-rotate-90" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Recent Exports
          </span>
          {needFollowUp > 0 && (
            <span className="rounded-pill bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              {needFollowUp} need follow-up
            </span>
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-surface-3 px-4 py-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-input bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {exports.map((exp) => {
                const config = statusConfig[exp.status] ?? statusConfig.stale;
                return (
                  <button
                    key={exp.domain}
                    onClick={() => router.push(`/exported?domain=${encodeURIComponent(exp.domain)}`)}
                    className="flex w-full items-center justify-between rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-left transition-colors duration-[180ms] hover:border-surface-3/80"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-xs font-medium text-text-primary">{exp.domain}</span>
                      <span className="ml-2 text-[10px] text-text-tertiary">
                        {exp.contactCount} contact{exp.contactCount !== 1 ? "s" : ""}
                        {" · "}
                        {exp.daysAgo === 0 ? "today" : `${exp.daysAgo}d ago`}
                      </span>
                    </div>
                    <span className={`flex-shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
