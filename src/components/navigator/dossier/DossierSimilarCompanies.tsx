"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { IcpScoreBadge } from "@/components/navigator/badges";
import { pick } from "@/lib/navigator/ui-copy";
import type { CompanyEnriched } from "@/lib/navigator/types";

interface PeerCompany extends Partial<CompanyEnriched> {
  domain: string;
  name?: string;
  peerSource?: "freshsales" | "exa" | null;
}

interface PeersResponse {
  freshsalesPeers: PeerCompany[];
  exaPeers: PeerCompany[];
}

async function fetchPeers(
  domain: string,
  options?: { minSize?: number; maxSize?: number; region?: string }
): Promise<PeersResponse> {
  const params = new URLSearchParams();
  if (options?.minSize != null) params.set("minSize", String(options.minSize));
  if (options?.maxSize != null) params.set("maxSize", String(options.maxSize));
  if (options?.region) params.set("region", options.region);
  const qs = params.toString();
  const url = `/api/company/${encodeURIComponent(domain)}/peers${qs ? `?${qs}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load peers");
  return res.json();
}

interface DossierSimilarCompaniesProps {
  domain: string;
  employeeCount?: number;
  region?: string;
}

export function DossierSimilarCompanies({ domain, employeeCount, region }: DossierSimilarCompaniesProps) {
  const selectCompany = useStore((s) => s.selectCompany);

  // Derive size range: +/-50% of current company's employee count
  const peerOptions = useMemo(() => {
    const opts: { minSize?: number; maxSize?: number; region?: string } = {};
    if (employeeCount && employeeCount > 0) {
      opts.minSize = Math.round(employeeCount * 0.5);
      opts.maxSize = Math.round(employeeCount * 1.5);
    }
    if (region) {
      opts.region = region;
    }
    return (opts.minSize != null || opts.maxSize != null || opts.region) ? opts : undefined;
  }, [employeeCount, region]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["company-peers", domain, peerOptions],
    queryFn: () => fetchPeers(domain, peerOptions),
    enabled: !!domain,
    staleTime: 30 * 60 * 1000, // 30min
  });

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-card bg-surface-0/50 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Similar Companies</h3>
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded border border-surface-3 px-2.5 py-1.5">
              <div className="shimmer h-3 w-24 rounded" />
              <div className="shimmer ml-auto h-3 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2 rounded-card bg-surface-0/50 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Similar Companies</h3>
        <div className="flex items-center gap-2 text-xs text-danger">
          <span>Failed to load peers.</span>
          <button
            onClick={() => refetch()}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const fsPeers = data?.freshsalesPeers ?? [];
  const exaPeers = data?.exaPeers ?? [];

  if (fsPeers.length === 0 && exaPeers.length === 0) {
    return (
      <div className="space-y-2 rounded-card bg-surface-0/50 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Similar Companies</h3>
        <p className="text-xs italic text-text-tertiary">{pick("empty_peers")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-card bg-surface-0/50 px-4 py-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Similar Companies</h3>

      {fsPeers.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-accent-primary/70">From CRM</p>
          <div className="space-y-1">
            {fsPeers.slice(0, 5).map((peer) => (
              <PeerCard key={peer.domain} peer={peer} onOpen={() => selectCompany(peer.domain)} />
            ))}
          </div>
        </div>
      )}

      {exaPeers.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-accent-secondary/70">Discovered</p>
          <div className="space-y-1">
            {exaPeers.slice(0, 5).map((peer) => (
              <PeerCard key={peer.domain} peer={peer} onOpen={() => selectCompany(peer.domain)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeerCard({ peer, onOpen }: { peer: PeerCompany; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded border border-surface-3 bg-surface-1 px-2.5 py-1.5 text-left transition-all duration-[180ms] hover:border-accent-secondary/30 hover:bg-surface-2/50"
    >
      <span className="truncate text-xs font-medium text-text-primary">{peer.name || peer.domain}</span>
      <span className="truncate text-[10px] text-text-tertiary">{peer.domain}</span>
      {peer.icpScore != null && peer.icpScore > 0 && (
        <span className="ml-auto flex-shrink-0">
          <IcpScoreBadge score={peer.icpScore} />
        </span>
      )}
      {peer.industry && (
        <span className="flex-shrink-0 text-[9px] text-text-tertiary">{peer.industry}</span>
      )}
    </button>
  );
}
