"use client";

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { IcpScoreBadge } from "@/components/navigator/badges";
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

async function fetchPeers(domain: string): Promise<PeersResponse> {
  const res = await fetch(`/api/company/${encodeURIComponent(domain)}/peers`);
  if (!res.ok) throw new Error("Failed to load peers");
  return res.json();
}

interface DossierSimilarCompaniesProps {
  domain: string;
}

export function DossierSimilarCompanies({ domain }: DossierSimilarCompaniesProps) {
  const selectCompany = useStore((s) => s.selectCompany);

  const { data, isLoading } = useQuery({
    queryKey: ["company-peers", domain],
    queryFn: () => fetchPeers(domain),
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

  const fsPeers = data?.freshsalesPeers ?? [];
  const exaPeers = data?.exaPeers ?? [];

  if (fsPeers.length === 0 && exaPeers.length === 0) return null;

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
