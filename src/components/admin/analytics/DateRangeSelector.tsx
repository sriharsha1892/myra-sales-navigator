"use client";

import { useState } from "react";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

interface DateRange {
  from: string;
  to: string;
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [mode, setMode] = useState<number | "custom">(() => {
    const today = toISODate(new Date());
    if (value.to !== today) return "custom";
    for (const p of PRESETS) {
      if (value.from === daysAgo(p.days)) return p.days;
    }
    return "custom";
  });
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);

  function selectPreset(days: number) {
    setMode(days);
    onChange({ from: daysAgo(days), to: toISODate(new Date()) });
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange({ from: customFrom, to: customTo });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => selectPreset(p.days)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
            mode === p.days
              ? "bg-accent-primary text-surface-0"
              : "border border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-hover"
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => setMode("custom")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
          mode === "custom"
            ? "bg-accent-primary text-surface-0"
            : "border border-surface-3 bg-surface-1 text-text-secondary hover:bg-surface-hover"
        }`}
      >
        Custom
      </button>

      {mode === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            max={customTo || toISODate(new Date())}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-input border border-surface-3 bg-surface-1 px-2 py-1 text-xs text-text-primary"
          />
          <span className="text-xs text-text-tertiary">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={toISODate(new Date())}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-input border border-surface-3 bg-surface-1 px-2 py-1 text-xs text-text-primary"
          />
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo || customFrom > customTo}
            className="rounded-input bg-accent-primary px-3 py-1 text-xs font-medium text-surface-0 transition-colors duration-150 hover:bg-accent-primary-hover disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
