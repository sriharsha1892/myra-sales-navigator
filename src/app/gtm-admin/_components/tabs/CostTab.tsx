"use client";

import { useState, useMemo } from "react";
import {
  useGtmOrganizations,
  useAddCostEntry,
} from "@/hooks/useGtmDashboardData";
import { ConfirmDialog } from "../ConfirmDialog";

export function CostTab() {
  const { data: organizations = [] } = useGtmOrganizations();
  const addCostEntry = useAddCostEntry();

  const [entryType, setEntryType] = useState<"incremental" | "absolute">(
    "incremental"
  );
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOrgs = useMemo(() => {
    if (!search) return organizations;
    const q = search.toLowerCase();
    return organizations.filter((o) => o.name.toLowerCase().includes(q));
  }, [organizations, search]);

  const segmentSubtotals = useMemo(() => {
    const map: Record<string, { cost: number; count: number }> = {};
    organizations.forEach((o) => {
      if (!map[o.segment])
        map[o.segment] = { cost: 0, count: 0 };
      map[o.segment].cost += o.costTotal;
      map[o.segment].count++;
    });
    return map;
  }, [organizations]);

  const grandTotal = organizations.reduce((s, o) => s + o.costTotal, 0);

  function handleSubmit() {
    if (!selectedOrgId || !amount) return;
    if (entryType === "absolute") {
      setShowConfirm(true);
      return;
    }
    doSubmit();
  }

  function doSubmit() {
    addCostEntry.mutate(
      {
        organizationId: selectedOrgId,
        amount: Number(amount),
        entryType,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setAmount("");
          setNotes("");
          setShowConfirm(false);
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Add Cost Entry
        </h4>

        <div className="flex gap-3 mb-4">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setEntryType("incremental")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                entryType === "incremental"
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500"
              }`}
            >
              Incremental
            </button>
            <button
              onClick={() => setEntryType("absolute")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                entryType === "absolute"
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500"
              }`}
            >
              Absolute
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Organization
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg mb-1 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              size={5}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              {filteredOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.segment})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder={
                entryType === "incremental" ? "Add amount" : "Set total to"
              }
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {entryType === "incremental"
                ? "Adds to current cost total"
                : "Overwrites current cost total"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              placeholder="Optional note"
            />
            <button
              onClick={handleSubmit}
              disabled={!selectedOrgId || !amount || addCostEntry.isPending}
              className="mt-3 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              {addCostEntry.isPending ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Segment Subtotals
        </h4>
        <div className="space-y-2">
          {Object.entries(segmentSubtotals).map(([seg, data]) => (
            <div
              key={seg}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50"
            >
              <span className="text-sm text-gray-700">{seg}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">
                  {data.count} orgs
                </span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  ${data.cost.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 flex items-center justify-between px-2">
            <span className="text-sm font-semibold text-gray-900">
              Grand Total*
            </span>
            <span className="text-lg font-semibold text-gray-900 tabular-nums">
              ${grandTotal.toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 px-2">
            * Total across all segments
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Overwrite Cost"
        message={`This will set the organization's cost total to $${amount}. Previous value will be replaced.`}
        confirmLabel="Overwrite"
        destructive
        onConfirm={doSubmit}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
