"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { AdminUiPreferences, ViewMode } from "@/lib/navigator/types";

export function UiPreferencesSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const prefs = config.uiPreferences;

  const update = (partial: Partial<AdminUiPreferences>) => {
    updateConfig({ uiPreferences: { ...prefs, ...partial } });
  };

  return (
    <AdminSection title="UI Preferences (Admin Defaults)">
      <div className="space-y-4">
        <div className="flex gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Left Panel Width (px)
            </label>
            <input
              type="number"
              value={prefs.defaultPanelWidths.left}
              onChange={(e) =>
                update({
                  defaultPanelWidths: { ...prefs.defaultPanelWidths, left: parseInt(e.target.value) || 280 },
                })
              }
              className="w-24 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Right Panel Width (px)
            </label>
            <input
              type="number"
              value={prefs.defaultPanelWidths.right}
              onChange={(e) =>
                update({
                  defaultPanelWidths: { ...prefs.defaultPanelWidths, right: parseInt(e.target.value) || 400 },
                })
              }
              className="w-24 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">Default View Mode</label>
          <div className="flex gap-2">
            {(["companies", "contacts"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => update({ defaultViewMode: mode })}
                className={`rounded-input px-3 py-1.5 text-xs capitalize ${
                  prefs.defaultViewMode === mode
                    ? "bg-accent-primary text-text-inverse"
                    : "border border-surface-3 text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Auto-Refresh Interval (minutes, 0 = disabled)
          </label>
          <input
            type="number"
            value={prefs.autoRefreshIntervalMin}
            onChange={(e) => update({ autoRefreshIntervalMin: parseInt(e.target.value) || 0 })}
            className="w-24 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.showConfidenceBadges}
            onChange={(e) => update({ showConfidenceBadges: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Show confidence badges</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.compactMode}
            onChange={(e) => update({ compactMode: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Compact mode</span>
        </label>
      </div>
    </AdminSection>
  );
}
