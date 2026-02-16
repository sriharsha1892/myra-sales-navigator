"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { BriefingData } from "@/lib/navigator/types";

interface PreCallBriefingCardProps {
  data?: BriefingData | null;
  loading?: boolean;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function daysAgoLabel(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

const warmthColors = {
  hot: { dot: "bg-accent-primary", label: "Hot" },
  warm: { dot: "bg-accent-highlight", label: "Warm" },
  cold: { dot: "bg-text-tertiary", label: "Cold" },
};

export function PreCallBriefingCard({ data, loading }: PreCallBriefingCardProps) {
  const [copied, setCopied] = useState(false);

  if (loading || !data) {
    return (
      <div className="mb-3 animate-pulse rounded-card border border-surface-3 bg-surface-1/80 p-3">
        <div className="h-3 w-32 rounded bg-surface-2" />
        <div className="mt-2 h-2.5 w-48 rounded bg-surface-2" />
        <div className="mt-2 h-2.5 w-40 rounded bg-surface-2" />
      </div>
    );
  }

  const w = warmthColors[data.crm.warmth];

  const handleCopyOpener = () => {
    navigator.clipboard.writeText(data.suggestedOpener).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mb-3 rounded-card border border-surface-3 bg-surface-1/80 backdrop-blur-sm" style={{ maxHeight: "260px" }}>
      {/* Contact + Company header */}
      <div className="border-b border-surface-3 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", w.dot)} title={w.label} />
          <span className="text-sm font-medium text-text-primary">{data.contact.name}</span>
          {data.contact.title && (
            <span className="text-xs text-text-secondary">&middot; {data.contact.title}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-tertiary">
          <span>{data.company.name}</span>
          <span>&middot;</span>
          <span>{data.company.industry || "\u2014"}</span>
          <span>&middot;</span>
          <span>{data.company.employeeCount?.toLocaleString() || "\u2014"} emp</span>
        </div>
        {data.company.icpReasoning && (
          <p className="mt-0.5 truncate text-[10px] italic text-text-tertiary" title={data.company.icpReasoning}>
            ICP {data.company.icpScore} — {data.company.icpReasoning}
          </p>
        )}
      </div>

      {/* CRM + Signal */}
      <div className="border-b border-surface-3 px-3 py-1.5 space-y-0.5">
        {data.crm.status !== "none" && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span>CRM: {data.crm.status.replace(/_/g, " ")}</span>
            {data.crm.topDeal && (
              <>
                <span className="text-text-tertiary">&middot;</span>
                <span>{data.crm.topDeal.name}</span>
                {data.crm.topDeal.amount && (
                  <span className="font-mono text-text-primary">{formatCurrency(data.crm.topDeal.amount)}</span>
                )}
                {data.crm.topDeal.daysInStage != null && data.crm.topDeal.daysInStage > 30 && (
                  <span className="text-[10px] font-medium text-danger">Stalled ({data.crm.topDeal.daysInStage}d)</span>
                )}
              </>
            )}
          </div>
        )}
        {data.crm.lastActivity && (
          <p className="text-[11px] text-text-tertiary">
            Last: {data.crm.lastActivity.type} from {data.crm.lastActivity.actor} ({daysAgoLabel(data.crm.lastActivity.date)})
          </p>
        )}
        {data.topSignal && (
          <p className="text-[11px] text-accent-secondary">
            Signal: {data.topSignal.title} ({daysAgoLabel(data.topSignal.date)})
          </p>
        )}
      </div>

      {/* Suggested opener */}
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs italic text-text-secondary leading-relaxed">
            &ldquo;{data.suggestedOpener}&rdquo;
          </p>
          <button
            onClick={handleCopyOpener}
            className="flex-shrink-0 text-text-tertiary hover:text-accent-primary transition-colors"
            title="Copy opener"
          >
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            )}
          </button>
        </div>
        {/* Previous steps timeline */}
        {data.previousSteps.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-tertiary">
            <span>Previous:</span>
            {data.previousSteps.map((s, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <span>&rarr;</span>}
                <span className="capitalize">{s.channel}</span>
                <span>({daysAgoLabel(s.completedAt)})</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
