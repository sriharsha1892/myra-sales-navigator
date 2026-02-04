"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/cn";

type InputMode = "absolute" | "delta";

interface SmartNumFieldProps {
  label: string;
  value: number;
  baseValue?: number;
  defaultMode?: InputMode;
  onChange: (v: number) => void;
}

export function SmartNumField({
  label,
  value,
  baseValue,
  defaultMode = "absolute",
  onChange,
}: SmartNumFieldProps) {
  const base = baseValue ?? 0;
  const hasBase = baseValue !== undefined && baseValue > 0;

  const [mode, setMode] = useState<InputMode>(hasBase ? defaultMode : "absolute");
  const [deltaInput, setDeltaInput] = useState(() =>
    mode === "delta" ? String(value - base) : "0"
  );

  // Sync deltaInput when value/base changes externally
  useEffect(() => {
    if (mode === "delta") {
      setDeltaInput(String(value - base));
    }
  }, [value, base, mode]);

  const clamp = useCallback((n: number) => Math.max(0, Math.round(n)), []);

  const handleAbsoluteChange = useCallback(
    (raw: string) => {
      const n = Number(raw);
      onChange(Number.isFinite(n) && n >= 0 ? clamp(n) : 0);
    },
    [onChange, clamp]
  );

  const handleDeltaChange = useCallback(
    (raw: string) => {
      setDeltaInput(raw);
      if (raw === "" || raw === "-" || raw === "+") return;
      const n = Number(raw);
      if (Number.isFinite(n)) {
        onChange(clamp(base + n));
      }
    },
    [base, onChange, clamp]
  );

  const nudge = useCallback(
    (amount: number) => {
      if (mode === "delta") {
        const currentDelta = value - base;
        const newDelta = currentDelta + amount;
        setDeltaInput(String(newDelta));
        onChange(clamp(base + newDelta));
      } else {
        onChange(clamp(value + amount));
      }
    },
    [mode, value, base, onChange, clamp]
  );

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "absolute" ? "delta" : "absolute";
      if (next === "delta") {
        setDeltaInput(String(value - base));
      }
      return next;
    });
  }, [value, base]);

  const delta = value - base;

  return (
    <div>
      {/* Header row: label + base info */}
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-xs text-gray-500 font-medium">{label}</label>
        {hasBase && (
          <span className="text-[10px] text-gray-400 font-mono tabular-nums">
            {mode === "delta" ? `base: ${base}` : `prev: ${base}`}
          </span>
        )}
      </div>

      {mode === "delta" && hasBase ? (
        /* ── Delta Mode ── */
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {/* Stepper down */}
            <button
              type="button"
              onClick={() => nudge(-1)}
              className="w-7 h-8 flex items-center justify-center text-sm font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              -
            </button>

            {/* Delta input */}
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                value={deltaInput}
                onChange={(e) => handleDeltaChange(e.target.value)}
                onBlur={() => {
                  // Clean up on blur
                  const n = Number(deltaInput);
                  if (!Number.isFinite(n)) setDeltaInput("0");
                }}
                className="w-full px-3 py-1.5 text-sm font-mono text-center border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 tabular-nums"
              />
            </div>

            {/* Stepper up */}
            <button
              type="button"
              onClick={() => nudge(1)}
              className="w-7 h-8 flex items-center justify-center text-sm font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              +
            </button>

            {/* Mode toggle */}
            <button
              type="button"
              onClick={toggleMode}
              className="px-1.5 py-1 text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-600 transition-colors whitespace-nowrap"
              title="Switch to absolute mode"
            >
              ABS
            </button>
          </div>

          {/* Quick increment pills */}
          <div className="flex items-center gap-1">
            {[1, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => nudge(n)}
                className="px-2 py-0.5 text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                +{n}
              </button>
            ))}
            <span className="flex-1" />
            {/* Resulting total */}
            <span className="text-xs font-mono text-gray-600 tabular-nums">
              = {value}
            </span>
          </div>
        </div>
      ) : (
        /* ── Absolute Mode ── */
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={value || ""}
            onChange={(e) => handleAbsoluteChange(e.target.value)}
            min={0}
            step={1}
            onKeyDown={(e) => {
              if (e.key === "-" || e.key === "e" || e.key === ".") e.preventDefault();
            }}
            className="w-full px-3 py-1.5 text-sm font-mono border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 tabular-nums"
          />

          {/* Mode toggle — only show if base exists */}
          {hasBase && (
            <button
              type="button"
              onClick={toggleMode}
              className="px-1.5 py-1 text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-600 transition-colors whitespace-nowrap"
              title="Switch to delta mode"
            >
              +/-
            </button>
          )}

          {/* Delta badge */}
          {hasBase && delta !== 0 && (
            <span
              className={cn(
                "text-[10px] font-mono tabular-nums whitespace-nowrap",
                delta > 0 ? "text-emerald-600" : "text-red-500"
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
