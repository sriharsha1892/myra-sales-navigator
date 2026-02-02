"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import type { DataRetentionSettings } from "@/lib/types";

export function DataRetentionSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.dataRetention;

  const update = (partial: Partial<DataRetentionSettings>) => {
    updateConfig({ dataRetention: { ...settings, ...partial } });
  };

  return (
    <AdminSection title="Data Retention">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Cache Purge Interval (hours)
          </label>
          <input
            type="number"
            value={settings.cachePurgeIntervalHours}
            onChange={(e) => update({ cachePurgeIntervalHours: parseInt(e.target.value) || 1 })}
            className="w-28 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Search History Retention (days)
          </label>
          <input
            type="number"
            value={settings.searchHistoryRetentionDays}
            onChange={(e) => update({ searchHistoryRetentionDays: parseInt(e.target.value) || 1 })}
            className="w-28 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Extraction Log Retention (days)
          </label>
          <input
            type="number"
            value={settings.extractionLogRetentionDays}
            onChange={(e) => update({ extractionLogRetentionDays: parseInt(e.target.value) || 1 })}
            className="w-28 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoPurge}
            onChange={(e) => update({ autoPurge: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Enable automatic purge</span>
        </label>
      </div>
    </AdminSection>
  );
}
