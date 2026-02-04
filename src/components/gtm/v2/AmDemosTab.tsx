"use client";

import { useState } from "react";

const DEFAULT_AMS = ["Satish", "Sudeshana", "Kirandeep", "Nikita"];

interface AmDemosTabProps {
  values: Record<string, number>;
  onChange: (amDemos: Record<string, number>) => void;
}

export function AmDemosTab({ values, onChange }: AmDemosTabProps) {
  const [newAm, setNewAm] = useState("");

  const ams = Array.from(
    new Set([...DEFAULT_AMS, ...Object.keys(values)])
  );

  const handleChange = (am: string, count: number) => {
    onChange({ ...values, [am]: count });
  };

  const handleAddAm = () => {
    if (!newAm.trim() || ams.includes(newAm.trim())) return;
    onChange({ ...values, [newAm.trim()]: 0 });
    setNewAm("");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">AM Demo Counts</h3>
      <div className="grid grid-cols-2 gap-3">
        {ams.map((am) => (
          <div
            key={am}
            className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-white"
          >
            <span className="flex-1 text-sm text-gray-700">{am}</span>
            <input
              type="number"
              value={values[am] ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                handleChange(am, Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              min={0}
              className="w-16 px-2 py-1 text-sm font-mono text-right border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 tabular-nums"
            />
            {!DEFAULT_AMS.includes(am) && (
              <button
                onClick={() => {
                  const next = { ...values };
                  delete next[am];
                  onChange(next);
                }}
                className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none"
                title={`Remove ${am}`}
                aria-label={`Remove ${am}`}
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          value={newAm}
          onChange={(e) => setNewAm(e.target.value)}
          placeholder="Add AM name..."
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          onKeyDown={(e) => e.key === "Enter" && handleAddAm()}
        />
        <button
          onClick={handleAddAm}
          disabled={!newAm.trim()}
          className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
