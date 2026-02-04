"use client";

import { useState } from "react";
import { DeltaBadge } from "./DeltaBadge";
import type { GtmEntry } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";

interface LeadGenSectionProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

export function LeadGenSection({ latest, previous }: LeadGenSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <h3 className="text-sm font-semibold text-gray-900">Lead Generation</h3>
        <svg
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform duration-[180ms]",
            expanded && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* Inbound */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Inbound
            </p>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Total"
                value={latest.inboundTotal}
                prev={previous?.inboundTotal ?? 0}
              />
              <MetricCard
                label="Active"
                value={latest.inboundActive}
                prev={previous?.inboundActive ?? 0}
              />
              <MetricCard
                label="Junk"
                value={latest.inboundJunk}
                prev={previous?.inboundJunk ?? 0}
                invert
              />
            </div>
          </div>

          {/* Outbound funnel */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Outbound Funnel
            </p>
            <div className="flex items-center gap-2">
              {[
                { label: "Leads", value: latest.outboundLeads, prev: previous?.outboundLeads ?? 0 },
                { label: "Reached", value: latest.outboundReached, prev: previous?.outboundReached ?? 0 },
                { label: "Followed", value: latest.outboundFollowed, prev: previous?.outboundFollowed ?? 0 },
                { label: "Qualified", value: latest.outboundQualified, prev: previous?.outboundQualified ?? 0 },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-2 flex-1">
                  <div className="flex-1 text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">
                      {step.label}
                    </p>
                    <p className="text-lg font-semibold text-gray-900 font-mono tabular-nums">
                      {step.value}
                    </p>
                    <DeltaBadge current={step.value} previous={step.prev} />
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-gray-300 text-xs">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Apollo */}
          {(latest.apolloContacts > 0 || latest.apolloNote) && (
            <div>
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                Apollo
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Contacts:</span>
                  <span className="text-sm font-semibold text-gray-900 font-mono tabular-nums">
                    {latest.apolloContacts}
                  </span>
                  <DeltaBadge
                    current={latest.apolloContacts}
                    previous={previous?.apolloContacts ?? 0}
                  />
                </div>
                {latest.apolloNote && (
                  <span className="text-xs text-gray-500">{latest.apolloNote}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  prev,
  invert = false,
}: {
  label: string;
  value: number;
  prev: number;
  invert?: boolean;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-[10px] text-gray-500 uppercase mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-gray-900 font-mono tabular-nums">
          {value}
        </span>
        <DeltaBadge current={value} previous={prev} invert={invert} />
      </div>
    </div>
  );
}
