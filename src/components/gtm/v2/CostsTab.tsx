"use client";

import { useState, useCallback, useRef } from "react";
import type { CostItem } from "@/lib/gtm/v2-types";

interface CostsTabProps {
  costItems: CostItem[];
  onCostItemsChange: (items: CostItem[]) => void;
  costPeriod: string;
  onCostPeriodChange: (period: string) => void;
}

export function CostsTab({
  costItems,
  onCostItemsChange,
  costPeriod,
  onCostPeriodChange,
}: CostsTabProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const [pasteBanner, setPasteBanner] = useState<string | null>(null);

  const updateItem = useCallback(
    (index: number, field: keyof CostItem, value: string | number) => {
      const next = [...costItems];
      next[index] = { ...next[index], [field]: value };
      onCostItemsChange(next);
    },
    [costItems, onCostItemsChange]
  );

  const removeItem = useCallback(
    (index: number) => {
      onCostItemsChange(costItems.filter((_, i) => i !== index));
    },
    [costItems, onCostItemsChange]
  );

  const addItem = useCallback(() => {
    onCostItemsChange([...costItems, { name: "", costUsd: 0, users: 0 }]);
  }, [costItems, onCostItemsChange]);

  const parseTsvRows = useCallback((text: string): CostItem[] => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: CostItem[] = [];
    for (const line of lines) {
      const hasTabs = line.includes("\t");
      const parts = hasTabs ? line.split("\t") : line.split(",");
      if (parts.length >= 2) {
        const name = parts[0]?.trim() ?? "";
        const costUsd = Number(parts[1]?.replace(/[,$]/g, "").trim() ?? 0);
        const users = Number(parts[2]?.trim() ?? 0);
        if (name) {
          parsed.push({
            name,
            costUsd: Number.isFinite(costUsd) ? costUsd : 0,
            users: Number.isFinite(users) ? Math.round(users) : 0,
          });
        }
      }
    }
    return parsed;
  }, []);

  const handleRowPaste = useCallback(
    (e: React.ClipboardEvent, rowIndex: number) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return;
      const parsed = parseTsvRows(text);
      if (parsed.length === 0) return;
      e.preventDefault();
      const next = [...costItems];
      const currentIsBlank = !next[rowIndex]?.name?.trim();
      if (currentIsBlank) {
        next.splice(rowIndex, 1, ...parsed);
      } else {
        next.splice(rowIndex + 1, 0, ...parsed);
      }
      onCostItemsChange(next);
      setPasteBanner(`${parsed.length} row${parsed.length !== 1 ? "s" : ""} pasted`);
      setTimeout(() => setPasteBanner(null), 2000);
    },
    [costItems, onCostItemsChange, parseTsvRows]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return;
      const parsed = parseTsvRows(text);
      if (parsed.length === 0) return;
      e.preventDefault();
      const existing = costItems.filter((it) => it.name.trim() !== "");
      onCostItemsChange([...existing, ...parsed]);
      setPasteBanner(`${parsed.length} row${parsed.length !== 1 ? "s" : ""} pasted`);
      setTimeout(() => setPasteBanner(null), 2000);
    },
    [costItems, onCostItemsChange, parseTsvRows]
  );

  const totalCost = costItems.reduce((s, it) => s + (it.costUsd || 0), 0);
  const totalUsers = costItems.reduce((s, it) => s + (it.users || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Cost Economics</h3>
        <p className="text-xs text-gray-500 mb-4">
          Enter cost items directly. You can paste TSV or CSV rows (name, cost, users) into any name field.
        </p>
      </div>

      {/* Period */}
      <div className="max-w-xs">
        <label className="text-xs text-gray-500 mb-1 block">Period</label>
        <input
          value={costPeriod}
          onChange={(e) => onCostPeriodChange(e.target.value)}
          placeholder="e.g. Jan 2026"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      {/* Paste banner */}
      {pasteBanner && (
        <div className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
          {pasteBanner}
        </div>
      )}

      {/* Cost table */}
      <div
        ref={tableRef}
        onPaste={handlePaste}
        className="border border-gray-200 rounded-lg overflow-hidden bg-white"
      >
        {/* Header */}
        <div
          className="grid items-center bg-gray-50 border-b border-gray-200"
          style={{ gridTemplateColumns: "minmax(200px, 2fr) 140px 100px 36px" }}
        >
          <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Name
          </div>
          <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
            Cost (USD)
          </div>
          <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
            Users
          </div>
          <div />
        </div>

        {/* Rows */}
        {costItems.map((item, i) => (
          <div
            key={i}
            className="grid items-center border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
            style={{ gridTemplateColumns: "minmax(200px, 2fr) 140px 100px 36px" }}
          >
            <div className="px-2 py-1">
              <input
                value={item.name}
                onChange={(e) => updateItem(i, "name", e.target.value)}
                onPaste={(e) => handleRowPaste(e, i)}
                placeholder="Organization name"
                className="w-full px-2 py-1.5 text-sm border border-transparent rounded focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-blue-500/20 bg-transparent"
              />
            </div>
            <div className="px-2 py-1">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                <input
                  type="number"
                  value={item.costUsd || ""}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updateItem(i, "costUsd", Number.isFinite(n) ? n : 0);
                  }}
                  min={0}
                  className="w-full pl-5 pr-2 py-1.5 text-sm font-mono text-right border border-transparent rounded focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-blue-500/20 bg-transparent tabular-nums"
                />
              </div>
            </div>
            <div className="px-2 py-1">
              <input
                type="number"
                value={item.users || ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  updateItem(i, "users", Number.isFinite(n) ? Math.round(n) : 0);
                }}
                min={0}
                className="w-full px-2 py-1.5 text-sm font-mono text-right border border-transparent rounded focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-blue-500/20 bg-transparent tabular-nums"
              />
            </div>
            <div className="flex items-center justify-center">
              <button
                onClick={() => removeItem(i)}
                className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none"
                title="Remove row"
                aria-label="Remove cost item"
              >
                &times;
              </button>
            </div>
          </div>
        ))}

        {/* Add row */}
        <div
          className="px-3 py-2 cursor-pointer hover:bg-blue-50/30 transition-colors group"
          onClick={addItem}
        >
          <span className="text-xs text-gray-300 group-hover:text-blue-400 transition-colors">
            + Add row
          </span>
        </div>

        {/* Totals */}
        {costItems.length > 0 && (
          <div
            className="grid items-center bg-gray-50 border-t border-gray-200"
            style={{ gridTemplateColumns: "minmax(200px, 2fr) 140px 100px 36px" }}
          >
            <div className="px-3 py-2 text-xs font-semibold text-gray-700">
              Total
            </div>
            <div className="px-3 py-2 text-sm font-semibold text-gray-900 font-mono tabular-nums text-right">
              ${totalCost.toLocaleString("en-US")}
            </div>
            <div className="px-3 py-2 text-sm font-semibold text-gray-900 font-mono tabular-nums text-right">
              {totalUsers}
            </div>
            <div />
          </div>
        )}
      </div>
    </div>
  );
}
