"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface SourceHealth {
  status: "healthy" | "degraded" | "down" | "unknown";
  errorRate: number;
  avgLatency: number;
  lastSuccess: string | null;
  rateLimitRemaining: number | null;
  callCount: number;
}

interface HealthError {
  created_at: string;
  source: string;
  endpoint: string;
  status_code: number | null;
  error_message: string | null;
  context: Record<string, unknown> | null;
}

interface HealthData {
  sources: Record<string, SourceHealth>;
  recentErrors: HealthError[];
}

const ALL_SOURCES = ["exa", "apollo", "hubspot", "freshsales", "clearout", "groq", "gemini"];

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  healthy: { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600" },
  degraded: { dot: "bg-amber-500", bg: "bg-amber-500/10", text: "text-amber-600" },
  down: { dot: "bg-red-500", bg: "bg-red-500/10", text: "text-red-600" },
  unknown: { dot: "bg-gray-400", bg: "bg-gray-400/10", text: "text-gray-500" },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function HealthDashboard() {
  const { data, isLoading, error } = useQuery<HealthData>({
    queryKey: ["health-status"],
    queryFn: async () => {
      const res = await fetch("/api/health/status");
      if (!res.ok) throw new Error("Failed to fetch health status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const [expandedError, setExpandedError] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="shimmer h-28 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger-light px-4 py-3">
        <p className="text-sm text-danger">Failed to load health data. Is the api_health_log table created in Supabase?</p>
      </div>
    );
  }

  const sources = data?.sources ?? {};
  const recentErrors = data?.recentErrors ?? [];

  return (
    <div className="space-y-6">
      {/* Section A: API Status Cards */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">API Status</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ALL_SOURCES.map((source) => {
            const health = sources[source];
            const status = health?.status ?? "unknown";
            const colors = STATUS_COLORS[status];

            return (
              <div
                key={source}
                className="rounded-card border border-surface-3 bg-surface-1 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize text-text-primary">
                    {source}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
                    <span className={`text-[10px] font-medium capitalize ${colors.text}`}>
                      {status}
                    </span>
                  </div>
                </div>

                {health ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-text-tertiary">
                      <span>Error rate</span>
                      <span className={health.errorRate > 5 ? "text-amber-500" : ""}>
                        {health.errorRate}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-text-tertiary">
                      <span>Avg latency</span>
                      <span>{health.avgLatency}ms</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-text-tertiary">
                      <span>Calls (1h)</span>
                      <span>{health.callCount}</span>
                    </div>
                    {health.rateLimitRemaining !== null && (
                      <div className="flex justify-between text-[10px] text-text-tertiary">
                        <span>Rate limit</span>
                        <span className={health.rateLimitRemaining < 100 ? "text-amber-500 font-medium" : ""}>
                          {health.rateLimitRemaining}
                        </span>
                      </div>
                    )}
                    {health.lastSuccess && (
                      <div className="flex justify-between text-[10px] text-text-tertiary">
                        <span>Last OK</span>
                        <span>{timeAgo(health.lastSuccess)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-text-tertiary">
                    No calls in last hour
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section B: Recent Errors */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          Recent Errors {recentErrors.length > 0 && (
            <span className="ml-1 text-text-tertiary font-normal">({recentErrors.length})</span>
          )}
        </h3>
        {recentErrors.length === 0 ? (
          <p className="text-xs text-text-tertiary">No errors in the last hour.</p>
        ) : (
          <div className="overflow-hidden rounded-card border border-surface-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-3 bg-surface-1">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Time</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Source</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Endpoint</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Error</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((err, i) => (
                  <>
                    <tr
                      key={i}
                      className="border-b border-surface-3 last:border-0 hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => setExpandedError(expandedError === i ? null : i)}
                    >
                      <td className="px-3 py-2 text-text-tertiary whitespace-nowrap">
                        {timeAgo(err.created_at)}
                      </td>
                      <td className="px-3 py-2 capitalize text-text-primary">{err.source}</td>
                      <td className="px-3 py-2 text-text-secondary font-mono max-w-[200px] truncate">
                        {err.endpoint}
                      </td>
                      <td className="px-3 py-2">
                        {err.status_code ? (
                          <span className="text-danger">{err.status_code}</span>
                        ) : (
                          <span className="text-text-tertiary">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-secondary max-w-[250px] truncate">
                        {err.error_message || "--"}
                      </td>
                    </tr>
                    {expandedError === i && err.context && (
                      <tr key={`${i}-ctx`}>
                        <td colSpan={5} className="bg-surface-1 px-3 py-2">
                          <pre className="text-[10px] text-text-tertiary font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {JSON.stringify(err.context, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section C: Sentry link */}
      <div className="flex items-center gap-3 rounded-card border border-surface-3 bg-surface-1 px-4 py-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-text-primary">Sentry Error Tracking</p>
          <p className="text-[10px] text-text-tertiary">
            {process.env.NEXT_PUBLIC_SENTRY_DSN
              ? "Sentry is configured and capturing errors."
              : "Set NEXT_PUBLIC_SENTRY_DSN to enable Sentry."}
          </p>
        </div>
        <a
          href="https://sentry.io"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-accent-primary hover:bg-surface-hover transition-colors"
        >
          Open Sentry &rarr;
        </a>
      </div>
    </div>
  );
}
