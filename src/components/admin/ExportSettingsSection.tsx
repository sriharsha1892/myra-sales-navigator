"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import type { ExportSettings } from "@/lib/types";

const ALL_CSV_COLUMNS = ["name", "email", "title", "company", "phone", "confidence", "seniority", "linkedin", "domain", "source"];

export function ExportSettingsSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.exportSettings;

  const update = (partial: Partial<ExportSettings>) => {
    updateConfig({ exportSettings: { ...settings, ...partial } });
  };

  const toggleColumn = (col: string) => {
    const cols = settings.csvColumns.includes(col)
      ? settings.csvColumns.filter((c) => c !== col)
      : [...settings.csvColumns, col];
    update({ csvColumns: cols });
  };

  return (
    <AdminSection title="Export Settings">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">Default Format</label>
          <div className="flex gap-2">
            {(["csv", "clipboard"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => update({ defaultFormat: fmt })}
                className={`rounded-input px-3 py-1.5 text-xs ${
                  settings.defaultFormat === fmt
                    ? "bg-accent-primary text-text-inverse"
                    : "border border-surface-3 text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {fmt === "csv" ? "CSV" : "Clipboard"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">CSV Columns</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CSV_COLUMNS.map((col) => (
              <label key={col} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.csvColumns.includes(col)}
                  onChange={() => toggleColumn(col)}
                  className="h-3 w-3 rounded accent-accent-primary"
                />
                <span className="text-xs text-text-secondary">{col}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">
            Confidence Threshold (min % to include)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.confidenceThreshold}
              onChange={(e) => update({ confidenceThreshold: parseInt(e.target.value) })}
              className="flex-1 accent-accent-primary"
            />
            <span className="w-12 text-right font-mono text-xs text-text-secondary">
              {settings.confidenceThreshold}%
            </span>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoVerifyOnExport}
            onChange={(e) => update({ autoVerifyOnExport: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Auto-verify emails via Clearout before export</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.includeCompanyContext}
            onChange={(e) => update({ includeCompanyContext: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Include company context in export</span>
        </label>
      </div>
    </AdminSection>
  );
}
