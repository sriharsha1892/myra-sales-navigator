"use client";

import { GlassCard } from "@/components/gtm-dashboard/GlassCard";
import type { GtmLeadGen, GtmSnapshot } from "@/lib/gtm-dashboard/types";

interface LeadGenCardProps {
  leadGen: GtmLeadGen | null;
  previousSnapshot: GtmSnapshot | null;
  loading?: boolean;
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${muted ? "text-gray-400" : "text-gray-600"}`}>
        {label}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          muted ? "text-gray-400" : "text-gray-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function LeadGenCard({ leadGen, previousSnapshot, loading }: LeadGenCardProps) {
  if (loading) {
    return (
      <GlassCard>
        <div className="shimmer h-4 w-32 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="shimmer h-3 w-16 rounded" />
                <div className="shimmer h-3 w-8 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="shimmer h-3 w-20 rounded" />
                <div className="shimmer h-3 w-8 rounded" />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    );
  }

  if (!leadGen) {
    return (
      <GlassCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Lead Generation
        </h3>
        <p className="text-sm text-gray-400">No data available</p>
      </GlassCard>
    );
  }

  const prevLg = previousSnapshot?.snapshotData?.lead_gen;

  return (
    <GlassCard>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Lead Generation
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
            Inbound
          </p>
          <Stat label="Total" value={leadGen.inboundTotal} />
          <Stat label="Active" value={leadGen.inboundActive} />
          <Stat label="Junk" value={leadGen.inboundJunk} muted />
        </div>
        <div>
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
            Outbound
          </p>
          <Stat label="Leads" value={leadGen.outboundLeads} />
          <Stat label="Reached" value={leadGen.outboundReached} />
          <Stat label="Followed Up" value={leadGen.outboundFollowed} />
          <Stat label="Qualified" value={leadGen.outboundQualified} />
        </div>
      </div>
      {leadGen.apolloStatus && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Apollo</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
              {leadGen.apolloContacts} contacts
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{leadGen.apolloStatus}</p>
        </div>
      )}
    </GlassCard>
  );
}
