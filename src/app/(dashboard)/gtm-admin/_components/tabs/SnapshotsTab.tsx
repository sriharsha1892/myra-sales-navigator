"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useGtmSnapshots,
  useCreateSnapshot,
  useGtmOrganizations,
  useGtmLeadGen,
} from "@/hooks/dashboard/useGtmDashboardData";
import { ALL_SEGMENTS } from "@/lib/gtm-dashboard/types";
import type { SnapshotData, GtmSnapshot } from "@/lib/gtm-dashboard/types";

export function SnapshotsTab() {
  const { data: snapshots = [] } = useGtmSnapshots();
  const { data: organizations = [] } = useGtmOrganizations();
  const { data: leadGen } = useGtmLeadGen();
  const createSnapshot = useCreateSnapshot();

  const [label, setLabel] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null);

  const buildSnapshotData = useCallback((): SnapshotData => {
    const segments: SnapshotData["segments"] = {};
    ALL_SEGMENTS.forEach((seg) => {
      const orgs = organizations.filter((o) => o.segment === seg);
      segments[seg] = {
        count: orgs.length,
        cost_total: orgs.reduce((s, o) => s + o.costTotal, 0),
        users_total: orgs.reduce((s, o) => s + o.usersCount, 0),
        conversations_total: orgs.reduce((s, o) => s + o.conversations, 0),
      };
    });

    return {
      segments,
      lead_gen: {
        inbound_total: leadGen?.inboundTotal ?? 0,
        inbound_active: leadGen?.inboundActive ?? 0,
        inbound_junk: leadGen?.inboundJunk ?? 0,
        outbound_leads: leadGen?.outboundLeads ?? 0,
        outbound_reached: leadGen?.outboundReached ?? 0,
        outbound_followed: leadGen?.outboundFollowed ?? 0,
        outbound_qualified: leadGen?.outboundQualified ?? 0,
        apollo_contacts: leadGen?.apolloContacts ?? 0,
        apollo_status: leadGen?.apolloStatus ?? "",
      },
    };
  }, [organizations, leadGen]);

  function handleSave() {
    if (!label.trim()) return;
    const data = buildSnapshotData();
    createSnapshot.mutate(
      { label, snapshotData: data },
      { onSuccess: () => setLabel("") }
    );
  }

  const compareData = useMemo(() => {
    if (!compareIds) return null;
    const [aId, bId] = compareIds;
    const a = snapshots.find((s) => s.id === aId);
    const b = snapshots.find((s) => s.id === bId);
    if (!a || !b) return null;
    return { a, b };
  }, [compareIds, snapshots]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Save Current Snapshot
        </h4>
        <div className="flex gap-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Week of 3 Feb 2026"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <button
            onClick={handleSave}
            disabled={!label.trim() || createSnapshot.isPending}
            className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {createSnapshot.isPending ? "Saving..." : "Save Snapshot"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">
            Past Snapshots
          </h4>
          {snapshots.length >= 2 && !compareIds && (
            <button
              onClick={() =>
                setCompareIds([snapshots[0].id, snapshots[1].id])
              }
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              Compare Latest
            </button>
          )}
          {compareIds && (
            <button
              onClick={() => setCompareIds(null)}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Close Comparison
            </button>
          )}
        </div>

        {compareData && (
          <CompareView a={compareData.a} b={compareData.b} />
        )}

        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-400">No snapshots yet</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map((s) => (
              <div
                key={s.id}
                className="border border-gray-100 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(expandedId === s.id ? null : s.id)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {expandedId === s.id ? "\u25BC" : "\u25B6"}
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {s.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(s.createdAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </button>

                {expandedId === s.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="grid grid-cols-4 gap-3 mt-3">
                      {Object.entries(s.snapshotData?.segments ?? {}).map(
                        ([seg, data]) => (
                          <div
                            key={seg}
                            className="bg-gray-50 rounded-lg p-2 text-center"
                          >
                            <p className="text-[11px] text-gray-400">
                              {seg}
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              {data.count}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompareView({ a, b }: { a: GtmSnapshot; b: GtmSnapshot }) {
  const segsA = a.snapshotData?.segments ?? {};
  const segsB = b.snapshotData?.segments ?? {};
  const allSegs = Array.from(
    new Set([...Object.keys(segsA), ...Object.keys(segsB)])
  );

  return (
    <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
        <span className="font-medium">{a.label}</span>
        <span>vs</span>
        <span className="font-medium">{b.label}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-gray-500 py-1">
              Segment
            </th>
            <th className="text-right text-xs font-medium text-gray-500 py-1">
              {a.label}
            </th>
            <th className="text-right text-xs font-medium text-gray-500 py-1">
              {b.label}
            </th>
            <th className="text-right text-xs font-medium text-gray-500 py-1">
              Delta
            </th>
          </tr>
        </thead>
        <tbody>
          {allSegs.map((seg) => {
            const aCount = segsA[seg]?.count ?? 0;
            const bCount = segsB[seg]?.count ?? 0;
            const delta = aCount - bCount;
            return (
              <tr key={seg} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-700">{seg}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">
                  {aCount}
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">
                  {bCount}
                </td>
                <td
                  className={`py-1.5 text-right tabular-nums font-medium ${
                    delta > 0
                      ? "text-emerald-600"
                      : delta < 0
                      ? "text-red-600"
                      : "text-gray-400"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
