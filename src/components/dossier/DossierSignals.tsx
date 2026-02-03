"use client";

import type { Signal } from "@/lib/types";
import { SourceBadge } from "@/components/badges";
import { pick } from "@/lib/ui-copy";

interface DossierSignalsProps {
  signals: Signal[];
}

const signalPillColors: Record<string, string> = {
  hiring: "bg-info-light text-accent-primary",
  funding: "bg-success-light text-success",
  expansion: "bg-warning-light text-warning",
  news: "bg-surface-2 text-text-secondary",
};

export function DossierSignals({ signals }: DossierSignalsProps) {
  if (signals.length === 0) {
    return (
      <div className="rounded-card bg-surface-0/50 px-4 py-3">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Signals
        </h3>
        <p className="text-xs italic text-text-tertiary">{pick("empty_dossier_signals")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-card bg-surface-0/50 px-4 py-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        Signals ({signals.length})
      </h3>
      <div className="space-y-2">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="rounded-card border border-surface-3 bg-surface-0 p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`inline-block rounded-pill px-2 py-0.5 text-[10px] font-medium capitalize ${signalPillColors[signal.type] ?? signalPillColors.news}`}>
                {signal.type}
              </span>
              <SourceBadge source={signal.source} />
            </div>
            <p className="mt-1 text-xs font-medium text-text-primary">
              {signal.title}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {signal.description}
            </p>
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-text-tertiary">
              <span>{new Date(signal.date).toLocaleDateString()}</span>
              {signal.sourceUrl && (
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:underline"
                >
                  Source &rarr;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
