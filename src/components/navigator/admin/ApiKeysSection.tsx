"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminSection } from "./AdminSection";

interface ProviderStatus {
  configured: boolean;
  credits: { available: number; total: number } | null;
  dashboardUrl: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  exa: "Exa",
  apollo: "Apollo",
  hubspot: "HubSpot",
  clearout: "Clearout",
  freshsales: "Freshsales",
};

const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  exa: "Semantic search engine — primary discovery",
  apollo: "Company search + contacts ($99/acct)",
  hubspot: "CRM status + contact source (pull-only)",
  clearout: "Email verification (on export)",
  freshsales: "CRM status + contacts",
};

const ENV_VAR_NAMES: Record<string, string> = {
  exa: "EXA_API_KEY",
  apollo: "APOLLO_API_KEY",
  hubspot: "HUBSPOT_ACCESS_TOKEN",
  clearout: "CLEAROUT_API_KEY",
  freshsales: "FRESHSALES_API_KEY + FRESHSALES_DOMAIN",
};

function CreditBadge({ available }: { available: number }) {
  if (available > 10000) {
    return <span className="rounded-badge bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">{available.toLocaleString()} credits</span>;
  }
  if (available >= 1000) {
    return <span className="rounded-badge bg-accent-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">{available.toLocaleString()} credits</span>;
  }
  return (
    <span className="rounded-badge bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger">
      {available.toLocaleString()} credits — running low
    </span>
  );
}

function StatusDot({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
        configured ? "bg-success" : "bg-text-tertiary"
      }`}
      aria-label={configured ? "Connected" : "Not configured"}
    />
  );
}

export function ApiKeysSection() {
  const [providers, setProviders] = useState<Record<string, ProviderStatus> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/credits");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connectedCount = providers
    ? Object.values(providers).filter((p) => p.configured).length
    : 0;
  const totalCount = providers ? Object.keys(providers).length : 5;

  return (
    <AdminSection title="Data Source Connections">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          {loading
            ? "Checking provider status..."
            : `${connectedCount}/${totalCount} providers connected via environment variables`}
        </p>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="text-[10px] text-accent-secondary hover:text-accent-secondary/80 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-2">
        {(Object.keys(PROVIDER_LABELS)).map((key) => {
          const status = providers?.[key];
          const configured = status?.configured ?? false;

          return (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-input border px-4 py-3 transition-colors ${
                configured
                  ? "border-success/20 bg-success/5"
                  : "border-surface-3 bg-surface-2"
              }`}
            >
              {loading ? (
                <span className="inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-surface-3" />
              ) : (
                <StatusDot configured={configured} />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary">
                    {PROVIDER_LABELS[key]}
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    {PROVIDER_DESCRIPTIONS[key]}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">
                  {ENV_VAR_NAMES[key]}
                  {!loading && (
                    <span className={configured ? "ml-2 text-success" : "ml-2 text-text-tertiary"}>
                      {configured ? "— set" : "— not set"}
                    </span>
                  )}
                </p>
              </div>

              {/* Credits or dashboard link */}
              <div className="flex-shrink-0 text-right">
                {status?.credits ? (
                  <CreditBadge available={status.credits.available} />
                ) : status?.dashboardUrl ? (
                  <a
                    href={status.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-accent-secondary hover:underline"
                  >
                    Dashboard
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-text-tertiary">
        API keys are configured via Vercel environment variables. To add or rotate a key, update the env var in the Vercel project settings and redeploy.
      </p>
    </AdminSection>
  );
}
