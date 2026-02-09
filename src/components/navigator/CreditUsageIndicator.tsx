"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface ProviderStatus {
  configured: boolean;
  credits: { available: number; total: number } | null;
  dashboardUrl: string | null;
}

interface CreditsResponse {
  providers: Record<string, ProviderStatus>;
  apolloReplenishDate?: string;
}

async function fetchCredits(): Promise<CreditsResponse> {
  const res = await fetch("/api/admin/credits");
  if (!res.ok) throw new Error("Credit info unavailable");
  return res.json();
}

export function CreditUsageIndicator() {
  const { data } = useQuery({
    queryKey: ["credits"],
    queryFn: fetchCredits,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (!data?.providers) return null;

  const sources = Object.entries(data.providers)
    .filter(([, p]) => p.configured && p.credits)
    .map(([key, p]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      credits: p.credits!,
    }));

  if (sources.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {sources.map((source) => {
        const ratio = source.credits.total > 0 ? source.credits.available / source.credits.total : 1;
        const isLow = ratio < 0.1;
        const replenishInfo = source.key === "apollo" && data.apolloReplenishDate
          ? ` — Replenishes ${data.apolloReplenishDate}`
          : "";
        const tooltip = `${source.label}: ${source.credits.available.toLocaleString()} credits remaining${replenishInfo}`;
        return (
          <Link
            key={source.key}
            href="/admin"
            title={tooltip}
            className={`cursor-pointer rounded-pill border border-surface-3 px-2 py-0.5 font-mono text-[10px] transition-colors hover:border-accent-primary hover:text-accent-primary ${
              isLow ? "text-amber-400 border-amber-400/40" : "text-text-tertiary"
            }`}
            aria-label={tooltip}
          >
            {source.label} {source.credits.available.toLocaleString()}{isLow ? ' (Low)' : ''}
          </Link>
        );
      })}
    </div>
  );
}
