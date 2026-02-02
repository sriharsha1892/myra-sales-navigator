"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface CreditData {
  clearout: { remaining: number; limit: number } | null;
  apollo: { remaining: number; limit: number } | null;
  exa: { remaining: number; limit: number } | null;
  hubspot: { remaining: number; limit: number } | null;
}

async function fetchCredits(): Promise<CreditData> {
  const res = await fetch("/api/admin/credits");
  if (!res.ok) throw new Error("Failed to fetch credits");
  return res.json();
}

export function CreditUsageIndicator() {
  const { data } = useQuery({
    queryKey: ["credits"],
    queryFn: fetchCredits,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (!data) return null;

  const sources = [
    { key: "clearout", label: "Clearout", data: data.clearout },
    { key: "apollo", label: "Apollo", data: data.apollo },
    { key: "exa", label: "Exa", data: data.exa },
    { key: "hubspot", label: "HubSpot", data: data.hubspot },
  ].filter((s) => s.data !== null);

  if (sources.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {sources.map((source) => {
        const d = source.data!;
        const usagePercent = d.limit > 0 ? ((d.limit - d.remaining) / d.limit) * 100 : 0;
        const isHigh = usagePercent > 90;
        return (
          <Link
            key={source.key}
            href="/admin"
            className={`cursor-pointer rounded-pill border border-surface-3 px-2 py-0.5 font-mono text-[10px] transition-colors hover:border-accent-primary hover:text-accent-primary ${
              isHigh ? "text-danger" : "text-text-tertiary"
            }`}
            title={`${source.label}: ${d.remaining} remaining of ${d.limit}`}
          >
            {source.label} {d.remaining}
          </Link>
        );
      })}
    </div>
  );
}
