"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { useStore } from "@/lib/navigator/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface ProviderCredit {
  configured: boolean;
  credits: { available: number; total: number } | null;
  dashboardUrl: string | null;
}

interface CreditsData {
  providers: Record<string, ProviderCredit>;
  apolloReplenishDate?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_SOURCES = [
  "exa",
  "apollo",
  "hubspot",
  "freshsales",
  "clearout",
  "serper",
  "groq",
  "gemini",
  "parallel",
];

const SOURCE_LABELS: Record<string, string> = {
  exa: "Exa",
  apollo: "Apollo",
  hubspot: "HubSpot",
  freshsales: "Freshsales",
  clearout: "Clearout",
  serper: "Serper",
  groq: "Groq",
  gemini: "Gemini",
  parallel: "Parallel",
};

const STATUS_COLORS: Record<string, { dot: string; text: string }> = {
  healthy: { dot: "bg-success", text: "text-success" },
  degraded: { dot: "bg-warning", text: "text-warning" },
  down: { dot: "bg-danger", text: "text-danger" },
  unknown: { dot: "bg-text-tertiary", text: "text-text-tertiary" },
};

/** Hardcoded cache TTLs from lib/cache.ts — shown as reference alongside admin overrides */
const CACHE_TTL_DEFAULTS: { key: string; label: string; minutes: number }[] = [
  { key: "exaSearch", label: "Exa search results", minutes: 360 },
  { key: "company", label: "Company enrichment", minutes: 120 },
  { key: "contacts", label: "Contacts list", minutes: 120 },
  { key: "enrichedContacts", label: "Enriched contacts", minutes: 120 },
  { key: "signals", label: "Signals", minutes: 60 },
  { key: "email", label: "Email verification (Clearout)", minutes: 1440 },
  { key: "hubspot", label: "HubSpot data", minutes: 30 },
  { key: "freshsales", label: "Freshsales data", minutes: 30 },
  { key: "serperSearch", label: "Serper search results", minutes: 360 },
  { key: "parallelSearch", label: "Parallel search results", minutes: 360 },
  { key: "search", label: "General search", minutes: 60 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  if (m % 60 === 0) return `${m / 60}h`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function creditPercent(available: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((available / total) * 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HealthDashboard() {
  // Health data (auto-refreshes every 30s)
  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
  } = useQuery<HealthData>({
    queryKey: ["health-status"],
    queryFn: async () => {
      const res = await fetch("/api/health/status");
      if (!res.ok) throw new Error("Failed to fetch health status");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // Credit data (refreshes every 5 min)
  const { data: creditsData } = useQuery<CreditsData>({
    queryKey: ["credits"],
    queryFn: async () => {
      const res = await fetch("/api/admin/credits");
      if (!res.ok) throw new Error("Credit info unavailable");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Admin-configured cache durations
  const cacheDurations = useStore((s) => s.adminConfig?.cacheDurations);

  const [expandedError, setExpandedError] = useState<number | null>(null);

  // --- Loading skeleton ---
  if (healthLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="shimmer h-28 rounded-card" />
          ))}
        </div>
        <div className="shimmer h-32 rounded-card" />
        <div className="shimmer h-40 rounded-card" />
      </div>
    );
  }

  // --- Error state ---
  if (healthError) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger-light px-4 py-3">
        <p className="text-sm text-danger">
          Failed to load health data. Is the api_health_log table created in
          Supabase?
        </p>
      </div>
    );
  }

  const sources = healthData?.sources ?? {};
  const recentErrors = healthData?.recentErrors ?? [];
  const providers = creditsData?.providers ?? {};

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Section A: API Status Cards                                       */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          API Status
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
                  <span className="text-xs font-semibold text-text-primary">
                    {SOURCE_LABELS[source] ?? source}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
                    <span
                      className={`text-[10px] font-medium capitalize ${colors.text}`}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                {health ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-text-tertiary">
                      <span>Error rate</span>
                      <span
                        className={
                          health.errorRate > 5 ? "text-amber-500" : ""
                        }
                      >
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
                        <span
                          className={
                            health.rateLimitRemaining < 100
                              ? "text-amber-500 font-medium"
                              : ""
                          }
                        >
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

      {/* ----------------------------------------------------------------- */}
      {/* Section B: Credit Usage                                           */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          Credit Usage
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(providers).map(([key, provider]) => {
            const label = SOURCE_LABELS[key] ?? key;
            const configured = provider.configured;
            const credits = provider.credits;
            const pct = credits
              ? creditPercent(credits.available, credits.total)
              : null;

            // Bar color: green > 25%, amber 10-25%, red < 10%
            let barColor = "bg-success";
            if (pct !== null && pct < 10) barColor = "bg-danger";
            else if (pct !== null && pct < 25) barColor = "bg-warning";

            return (
              <div
                key={key}
                className="rounded-card border border-surface-3 bg-surface-1 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">
                    {label}
                  </span>
                  {configured ? (
                    <span className="rounded-badge bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                      Configured
                    </span>
                  ) : (
                    <span className="rounded-badge bg-text-tertiary/10 px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
                      Not configured
                    </span>
                  )}
                </div>

                {credits ? (
                  <div className="mt-2">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-sm font-semibold text-text-primary">
                        {credits.available.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        / {credits.total.toLocaleString()}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.max(pct ?? 0, 1)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-text-tertiary">
                      <span>{pct}% remaining</span>
                      {key === "apollo" && creditsData?.apolloReplenishDate && (
                        <span>
                          Replenishes {creditsData.apolloReplenishDate}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-text-tertiary">
                    {configured
                      ? "No credit tracking for this provider"
                      : "API key not set"}
                  </p>
                )}

                {provider.dashboardUrl && (
                  <a
                    href={provider.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[10px] text-accent-primary hover:text-accent-primary/80 transition-colors"
                  >
                    Open dashboard &rarr;
                  </a>
                )}
              </div>
            );
          })}
          {Object.keys(providers).length === 0 && (
            <p className="text-xs text-text-tertiary col-span-full">
              Credit data unavailable.
            </p>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section C: Cache Configuration                                    */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          Cache Configuration
        </h3>
        <div className="rounded-card border border-surface-3 bg-surface-1 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-3">
                <th className="px-3 py-2 text-left font-medium text-text-secondary">
                  Cache Key
                </th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">
                  Default TTL
                </th>
                {cacheDurations && (
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">
                    Admin Override
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {CACHE_TTL_DEFAULTS.map((entry) => {
                // Check if there's a matching admin-configured override
                const adminKey = entry.key.replace("Search", "").toLowerCase();
                const override = cacheDurations?.[adminKey as keyof typeof cacheDurations];

                return (
                  <tr
                    key={entry.key}
                    className="border-b border-surface-3 last:border-0"
                  >
                    <td className="px-3 py-2">
                      <span className="text-text-primary">{entry.label}</span>
                      <span className="ml-2 font-mono text-[10px] text-text-tertiary">
                        {entry.key}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-text-secondary">
                      {formatMinutes(entry.minutes)}
                    </td>
                    {cacheDurations && (
                      <td className="px-3 py-2 text-right font-mono">
                        {override !== undefined ? (
                          <span
                            className={
                              override !== entry.minutes
                                ? "text-accent-primary font-medium"
                                : "text-text-tertiary"
                            }
                          >
                            {formatMinutes(override)}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">--</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-surface-3 px-3 py-2">
            <p className="text-[10px] text-text-tertiary">
              Default TTLs are hardcoded in lib/cache.ts. Admin overrides are
              configurable under System &rarr; Data Freshness.
            </p>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section D: Recent Errors                                          */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          Recent Errors{" "}
          {recentErrors.length > 0 && (
            <span className="ml-1 font-normal text-text-tertiary">
              ({recentErrors.length})
            </span>
          )}
        </h3>
        {recentErrors.length === 0 ? (
          <p className="text-xs text-text-tertiary">
            No errors in the last hour.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-surface-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-3 bg-surface-1">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    Time
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    Source
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    Endpoint
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((err, i) => (
                  <Fragment key={i}>
                    <tr
                      className="border-b border-surface-3 last:border-0 cursor-pointer transition-colors hover:bg-surface-hover"
                      onClick={() =>
                        setExpandedError(expandedError === i ? null : i)
                      }
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-text-tertiary">
                        {timeAgo(err.created_at)}
                      </td>
                      <td className="px-3 py-2 capitalize text-text-primary">
                        {err.source}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 font-mono text-text-secondary">
                        {err.endpoint}
                      </td>
                      <td className="px-3 py-2">
                        {err.status_code ? (
                          <span className="text-danger">
                            {err.status_code}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">--</span>
                        )}
                      </td>
                      <td className="max-w-[250px] truncate px-3 py-2 text-text-secondary">
                        {err.error_message || "--"}
                      </td>
                    </tr>
                    {expandedError === i && err.context && (
                      <tr>
                        <td colSpan={5} className="bg-surface-1 px-3 py-2">
                          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-text-tertiary">
                            {JSON.stringify(err.context, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Section E: Sentry link                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3 rounded-card border border-surface-3 bg-surface-1 px-4 py-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-text-primary">
            Sentry Error Tracking
          </p>
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
          className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-accent-primary transition-colors hover:bg-surface-hover"
        >
          Open Sentry &rarr;
        </a>
      </div>
    </div>
  );
}
