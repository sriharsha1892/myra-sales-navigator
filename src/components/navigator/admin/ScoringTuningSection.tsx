"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { ScoringSettings } from "@/lib/navigator/types";

const SOURCES = ["exa", "apollo", "hubspot", "freshsales"];

export function ScoringTuningSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.scoringSettings;

  const update = (partial: Partial<ScoringSettings>) => {
    updateConfig({ scoringSettings: { ...settings, ...partial } });
  };

  const updateSourceConfidence = (source: string, value: number) => {
    update({
      perSourceConfidence: { ...settings.perSourceConfidence, [source]: value },
    });
  };

  return (
    <AdminSection title="Scoring Tuning">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">
            Display Threshold (min ICP score to show badge)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.displayThreshold}
              onChange={(e) => update({ displayThreshold: parseInt(e.target.value) })}
              className="flex-1 accent-accent-primary"
            />
            <span className="w-12 text-right font-mono text-xs text-text-secondary">
              {settings.displayThreshold}
            </span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase text-text-tertiary">
            Per-Source Confidence Baseline
          </label>
          <div className="space-y-2">
            {SOURCES.map((source) => (
              <div key={source} className="flex items-center gap-3">
                <span className="w-20 text-xs capitalize text-text-secondary">{source}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.perSourceConfidence[source] ?? 80}
                  onChange={(e) => updateSourceConfidence(source, parseInt(e.target.value))}
                  className="flex-1 accent-accent-primary"
                />
                <span className="w-12 text-right font-mono text-xs text-text-secondary">
                  {settings.perSourceConfidence[source] ?? 80}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Staleness Decay (days)
            </label>
            <input
              type="number"
              value={settings.stalenessDecayDays}
              onChange={(e) => update({ stalenessDecayDays: parseInt(e.target.value) || 1 })}
              className="w-24 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Decay % per period
            </label>
            <input
              type="number"
              value={settings.stalenessDecayPercent}
              onChange={(e) => update({ stalenessDecayPercent: parseInt(e.target.value) || 0 })}
              className="w-24 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
        </div>
      </div>
    </AdminSection>
  );
}
