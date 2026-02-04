"use client";

import { DeltaBadge } from "./DeltaBadge";
import type { GtmEntry } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";

interface LeadGenSectionProps {
  latest: GtmEntry;
  previous: GtmEntry | null;
}

function conversionColor(pct: number): string {
  if (pct >= 70) return "text-emerald-600 bg-emerald-50";
  if (pct >= 40) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

export function LeadGenSection({ latest, previous }: LeadGenSectionProps) {
  const funnelSteps = [
    { label: "Leads", value: latest.outboundLeads, prev: previous?.outboundLeads ?? 0 },
    { label: "Reached", value: latest.outboundReached, prev: previous?.outboundReached ?? 0 },
    { label: "Followed", value: latest.outboundFollowed, prev: previous?.outboundFollowed ?? 0 },
    { label: "Qualified", value: latest.outboundQualified, prev: previous?.outboundQualified ?? 0 },
  ];

  const conversions: (number | null)[] = funnelSteps.map((step, i) => {
    if (i === 0) return null;
    const prev = funnelSteps[i - 1].value;
    if (prev === 0) return null;
    return Math.round((step.value / prev) * 100);
  });

  const inboundCards = [
    { label: "Total", value: latest.inboundTotal, prev: previous?.inboundTotal ?? 0, invert: false, color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
    { label: "Active", value: latest.inboundActive, prev: previous?.inboundActive ?? 0, invert: false, color: "bg-teal-50 border-teal-200 text-teal-700" },
    { label: "Junk", value: latest.inboundJunk, prev: previous?.inboundJunk ?? 0, invert: true, color: "bg-rose-50 border-rose-200 text-rose-600" },
  ];

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Lead Generation</h3>

      {/* Inbound */}
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
        Inbound
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {inboundCards.map((card) => (
          <div key={card.label} className={cn("rounded-lg border p-2.5", card.color)}>
            <p className="text-[9px] font-medium uppercase tracking-wide opacity-70 mb-0.5">{card.label}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold font-mono tabular-nums">{card.value}</span>
              <DeltaBadge current={card.value} previous={card.prev} invert={card.invert} />
            </div>
          </div>
        ))}
      </div>

      {/* Outbound funnel */}
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
        Outbound Funnel
      </p>
      <div className="flex items-stretch gap-0">
        {funnelSteps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            {conversions[i] !== null && conversions[i] !== undefined && (
              <div className="flex flex-col items-center px-1.5 shrink-0">
                <span className="text-gray-300 text-base">&rarr;</span>
                <span className={cn("text-[11px] font-semibold font-mono px-2 py-0.5 rounded-full", conversionColor(conversions[i]!))}>
                  {conversions[i]}%
                </span>
              </div>
            )}
            <div className="flex-1 text-center p-2 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-[9px] text-gray-500 uppercase mb-0.5 font-medium">{step.label}</p>
              <p className="text-lg font-semibold text-gray-900 font-mono tabular-nums">{step.value}</p>
              <DeltaBadge current={step.value} previous={step.prev} />
            </div>
          </div>
        ))}
      </div>

      {/* Apollo */}
      {(latest.apolloContacts > 0 || latest.apolloNote) && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium text-gray-400 uppercase">Apollo</span>
            <span className="text-sm font-semibold text-gray-900 font-mono tabular-nums">{latest.apolloContacts}</span>
            <DeltaBadge current={latest.apolloContacts} previous={previous?.apolloContacts ?? 0} />
            {latest.apolloNote && <span className="text-[10px] text-gray-500">{latest.apolloNote}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
