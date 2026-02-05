"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { isGtmAuthed, setGtmAuthed } from "@/lib/gtm-dashboard/auth";
import { PinAuthModal } from "@/components/gtm-dashboard/PinAuthModal";
import {
  useAmPerformanceReports,
  useAmPerformanceById,
  useSaveAmPerformance,
} from "@/hooks/dashboard/useGtmV2";
import { cn } from "@/lib/cn";
import { GtmToastProvider, useGtmToast } from "@/components/gtm/v2/Toast";
import type { AmPerformanceRow, AmChannelBreakdown } from "@/lib/gtm/v2-types";

const DEFAULT_AMS = ["Satish Boini", "Satya", "Nikita Manmode", "Sudeshana Jain", "Kirandeep Kaur"];

const EMPTY_CHANNELS: AmChannelBreakdown = { email: 0, calls: 0, linkedin: 0, waOther: 0 };

function emptyRow(name: string): AmPerformanceRow {
  return {
    name,
    outreach: 0,
    demos: 0,
    sales: 0,
    demoChannels: null,
    outreachChannels: null,
    note: "",
    status: "active",
  };
}

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AmPerformanceContent() {
  const [authed, setAuthed] = useState(() => isGtmAuthed());
  const { addToast } = useGtmToast();

  const { data: reports, isLoading: reportsLoading } = useAmPerformanceReports(authed);
  const saveMutation = useSaveAmPerformance();

  // Selected report (null = new)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: selectedReport } = useAmPerformanceById(selectedId);

  // Form state
  const [periodStart, setPeriodStart] = useState("2025-12-01");
  const [periodEnd, setPeriodEnd] = useState(todayDate());
  const [rows, setRows] = useState<AmPerformanceRow[]>(() =>
    DEFAULT_AMS.map((n) => emptyRow(n))
  );
  const [saving, setSaving] = useState(false);
  const [newAmName, setNewAmName] = useState("");

  const synced = useRef<string | null>(null);

  // Sync from selected report
  useEffect(() => {
    if (!selectedReport) return;
    const key = selectedReport.id;
    if (synced.current === key) return;
    synced.current = key;
    setPeriodStart(selectedReport.periodStart);
    setPeriodEnd(selectedReport.periodEnd);
    // Merge default AMs with report data
    const reportNames = new Set(selectedReport.amData.map((r) => r.name));
    const merged = [
      ...selectedReport.amData,
      ...DEFAULT_AMS.filter((n) => !reportNames.has(n)).map((n) => emptyRow(n)),
    ];
    setRows(merged);
  }, [selectedReport]);

  // Reset sync when selection changes
  useEffect(() => {
    synced.current = null;
  }, [selectedId]);

  const updateRow = useCallback((index: number, patch: Partial<AmPerformanceRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMutation.mutateAsync({
        id: selectedId ?? undefined,
        periodStart,
        periodEnd,
        amData: rows,
      });
      addToast("AM Performance saved", "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddAm = () => {
    const name = newAmName.trim();
    if (!name || rows.some((r) => r.name === name)) return;
    setRows((prev) => [...prev, emptyRow(name)]);
    setNewAmName("");
  };

  const handleRemoveAm = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  if (!authed) {
    return (
      <PinAuthModal
        onSuccess={() => {
          setGtmAuthed();
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8ecf3] via-[#f3eff8] to-[#edf5f2]">
      {/* Header */}
      <div className="border-b border-gray-200/50 bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/gtmcatchup"
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                &larr; Dashboard
              </a>
              <h1 className="text-lg font-semibold text-gray-900">
                AM Performance
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Report picker */}
              {reports && reports.length > 0 && (
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value="">New Report</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.periodStart} to {r.periodEnd}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={handleSave}
                disabled={saving || periodEnd <= periodStart}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-lg transition-colors",
                  "bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
                )}
              >
                {saving ? "Saving..." : selectedId ? "Update Report" : "Save Report"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Period picker */}
        <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5 mb-4">
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Period</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            {periodStart && periodEnd && periodEnd > periodStart && (
              <span className="text-xs text-gray-400">
                {Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (7 * 86400000))} weeks
              </span>
            )}
            {periodStart && periodEnd && periodEnd <= periodStart && (
              <span className="text-xs text-red-500 font-medium">End date must be after start date</span>
            )}
          </div>
        </div>

        {/* AM Table */}
        <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-40">AM</th>
                  <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">Outreach</th>
                  <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-16">Demos</th>
                  <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-16">Sales</th>
                  <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">OR→D</th>
                  <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">D→S</th>
                  <th className="text-center px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">Status</th>
                  <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Note</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const orToD = row.outreach > 0 ? ((row.demos / row.outreach) * 100).toFixed(1) + "%" : "—";
                  const dToS = row.demos > 0 ? ((row.sales / row.demos) * 100).toFixed(1) + "%" : "—";
                  return (
                    <tr key={row.name} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span className={cn("text-sm font-medium", row.status === "inactive" && "text-gray-400")}>
                          {row.name}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.outreach || ""}
                          onChange={(e) => updateRow(i, { outreach: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full text-right font-mono text-sm tabular-nums px-2 py-1 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.demos || ""}
                          onChange={(e) => updateRow(i, { demos: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full text-right font-mono text-sm tabular-nums px-2 py-1 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={row.sales || ""}
                          onChange={(e) => updateRow(i, { sales: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full text-right font-mono text-sm tabular-nums px-2 py-1 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-gray-500 tabular-nums">{orToD}</td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-gray-500 tabular-nums">{dToS}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => updateRow(i, { status: row.status === "active" ? "inactive" : "active" })}
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded",
                            row.status === "active"
                              ? "text-emerald-700 bg-emerald-50"
                              : "text-gray-400 bg-gray-100"
                          )}
                        >
                          {row.status}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) => updateRow(i, { note: e.target.value })}
                          placeholder="Notes..."
                          className="w-full text-xs text-gray-600 px-2 py-1 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        />
                      </td>
                      <td className="px-2 py-3">
                        {!DEFAULT_AMS.includes(row.name) && (
                          <button
                            onClick={() => handleRemoveAm(i)}
                            className="text-gray-300 hover:text-red-500 transition-colors text-sm"
                            title={`Remove ${row.name}`}
                          >
                            &times;
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50/80 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total ({rows.filter((r) => r.status === "active").length} AMs)</td>
                  <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">{rows.reduce((s, r) => s + r.outreach, 0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">{rows.reduce((s, r) => s + r.demos, 0)}</td>
                  <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">{rows.reduce((s, r) => s + r.sales, 0)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-gray-500 tabular-nums">
                    {(() => { const o = rows.reduce((s, r) => s + r.outreach, 0); const d = rows.reduce((s, r) => s + r.demos, 0); return o > 0 ? ((d / o) * 100).toFixed(1) + "%" : "—"; })()}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-gray-500 tabular-nums">
                    {(() => { const d = rows.reduce((s, r) => s + r.demos, 0); const sl = rows.reduce((s, r) => s + r.sales, 0); return d > 0 ? ((sl / d) * 100).toFixed(1) + "%" : "—"; })()}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Channel breakdown */}
          <div className="border-t border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Channel Breakdown (optional)</h3>
            <div className="space-y-3">
              {rows.map((row, i) => (
                <ChannelRow
                  key={row.name}
                  row={row}
                  onChange={(patch) => updateRow(i, patch)}
                />
              ))}
            </div>
          </div>

          {/* Add AM */}
          <div className="border-t border-gray-200 px-5 py-4">
            <div className="flex gap-2 items-center">
              <input
                value={newAmName}
                onChange={(e) => setNewAmName(e.target.value)}
                placeholder="Add AM name..."
                className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                onKeyDown={(e) => e.key === "Enter" && handleAddAm()}
              />
              <button
                onClick={handleAddAm}
                disabled={!newAmName.trim()}
                className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelRow({
  row,
  onChange,
}: {
  row: AmPerformanceRow;
  onChange: (patch: Partial<AmPerformanceRow>) => void;
}) {
  const [expanded, setExpanded] = useState(
    () => row.demoChannels !== null || row.outreachChannels !== null
  );

  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <span className={cn("text-sm w-36", row.status === "inactive" && "text-gray-400")}>{row.name}</span>
        <button
          onClick={() => {
            setExpanded(true);
            if (!row.demoChannels) onChange({ demoChannels: { ...EMPTY_CHANNELS } });
            if (!row.outreachChannels) onChange({ outreachChannels: { ...EMPTY_CHANNELS } });
          }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          + Add channels
        </button>
      </div>
    );
  }

  const channels: (keyof AmChannelBreakdown)[] = ["email", "calls", "linkedin", "waOther"];
  const labels: Record<string, string> = { email: "Email", calls: "Calls", linkedin: "LI", waOther: "WA/O" };

  return (
    <div className="flex items-start gap-3 text-xs">
      <span className={cn("text-sm w-36 pt-1", row.status === "inactive" && "text-gray-400")}>{row.name}</span>
      <div className="flex-1 grid grid-cols-2 gap-3">
        {/* Demo channels */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Demo Source</div>
          <div className="flex gap-1">
            {channels.map((ch) => (
              <div key={ch} className="flex-1">
                <div className="text-[10px] text-gray-400 text-center">{labels[ch]}</div>
                <input
                  type="number"
                  value={row.demoChannels?.[ch] ?? 0}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    onChange({
                      demoChannels: { ...(row.demoChannels ?? EMPTY_CHANNELS), [ch]: val },
                    });
                  }}
                  min={0}
                  className="w-full text-center font-mono text-xs tabular-nums px-1 py-1 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
            ))}
          </div>
        </div>
        {/* Outreach channels */}
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Outreach Volume</div>
          <div className="flex gap-1">
            {channels.map((ch) => (
              <div key={ch} className="flex-1">
                <div className="text-[10px] text-gray-400 text-center">{labels[ch]}</div>
                <input
                  type="number"
                  value={row.outreachChannels?.[ch] ?? 0}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value) || 0);
                    onChange({
                      outreachChannels: { ...(row.outreachChannels ?? EMPTY_CHANNELS), [ch]: val },
                    });
                  }}
                  min={0}
                  className="w-full text-center font-mono text-xs tabular-nums px-1 py-1 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AmPerformancePageInner() {
  return (
    <GtmToastProvider>
      <AmPerformanceContent />
    </GtmToastProvider>
  );
}
