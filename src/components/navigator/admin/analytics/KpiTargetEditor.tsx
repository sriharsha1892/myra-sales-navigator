"use client";

import { useState } from "react";

interface KpiTargets {
  exportsThisWeek: number;
  avgIcpScore: number;
}

interface KpiTargetEditorProps {
  targets: KpiTargets;
  onSave: (targets: KpiTargets) => void;
  saving?: boolean;
}

export function KpiTargetEditor({ targets, onSave, saving }: KpiTargetEditorProps) {
  const [exports, setExports] = useState(targets.exportsThisWeek);
  const [avgIcp, setAvgIcp] = useState(targets.avgIcpScore);
  const changed = exports !== targets.exportsThisWeek || avgIcp !== targets.avgIcpScore;

  return (
    <div className="flex items-end gap-4">
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-text-tertiary">
          Exports/week target
        </label>
        <input
          type="number"
          min={0}
          value={exports}
          onChange={(e) => setExports(Number(e.target.value))}
          className="mt-1 w-20 rounded-input border border-surface-3 bg-surface-1 px-2 py-1 font-mono text-sm text-text-primary"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-text-tertiary">
          Avg ICP target
        </label>
        <input
          type="number"
          min={0}
          max={100}
          value={avgIcp}
          onChange={(e) => setAvgIcp(Number(e.target.value))}
          className="mt-1 w-20 rounded-input border border-surface-3 bg-surface-1 px-2 py-1 font-mono text-sm text-text-primary"
        />
      </div>
      {changed && (
        <button
          onClick={() => onSave({ exportsThisWeek: exports, avgIcpScore: avgIcp })}
          disabled={saving}
          className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-surface-0 transition-colors duration-150 hover:bg-accent-primary-hover disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save targets"}
        </button>
      )}
    </div>
  );
}
