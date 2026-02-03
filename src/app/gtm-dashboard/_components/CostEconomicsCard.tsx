"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/gtm-dashboard/GlassCard";
import type { GtmOrganization } from "@/lib/gtm-dashboard/types";

interface CostEconomicsCardProps {
  organizations: GtmOrganization[];
  loading?: boolean;
}

type CostSegment = "Paying" | "Strong Prospect" | "Active Trial";
const COST_SEGMENTS: CostSegment[] = [
  "Paying",
  "Strong Prospect",
  "Active Trial",
];

type SortKey = "name" | "cost" | "conversations" | "users";

export function CostEconomicsCard({ organizations, loading }: CostEconomicsCardProps) {
  const [activeTab, setActiveTab] = useState<CostSegment>("Paying");
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortAsc, setSortAsc] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<CostSegment, GtmOrganization[]> = {
      Paying: [],
      "Strong Prospect": [],
      "Active Trial": [],
    };
    organizations.forEach((o) => {
      if (o.segment in map) {
        map[o.segment as CostSegment].push(o);
      }
    });
    return map;
  }, [organizations]);

  const totalPlatformCost = useMemo(
    () =>
      organizations.reduce((sum, o) => sum + o.costTotal, 0),
    [organizations]
  );

  const summaryCards = useMemo(() => {
    return COST_SEGMENTS.map((seg) => {
      const orgs = grouped[seg];
      return {
        segment: seg,
        count: orgs.length,
        cost: orgs.reduce((s, o) => s + o.costTotal, 0),
        users: orgs.reduce((s, o) => s + o.usersCount, 0),
      };
    });
  }, [grouped]);

  const sortedOrgs = useMemo(() => {
    const orgs = [...(grouped[activeTab] ?? [])];
    orgs.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "cost":
          cmp = a.costTotal - b.costTotal;
          break;
        case "conversations":
          cmp = a.conversations - b.conversations;
          break;
        case "users":
          cmp = a.usersCount - b.usersCount;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return orgs;
  }, [grouped, activeTab, sortKey, sortAsc]);

  const tabTotals = useMemo(() => {
    const orgs = grouped[activeTab] ?? [];
    return {
      cost: orgs.reduce((s, o) => s + o.costTotal, 0),
      conversations: orgs.reduce((s, o) => s + o.conversations, 0),
      users: orgs.reduce((s, o) => s + o.usersCount, 0),
    };
  }, [grouped, activeTab]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortHeader({ k, label }: { k: SortKey; label: string }) {
    return (
      <th
        className="text-right px-3 py-2 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none"
        onClick={() => handleSort(k)}
      >
        {label}
        {sortKey === k && (
          <span className="ml-1">{sortAsc ? "\u2191" : "\u2193"}</span>
        )}
      </th>
    );
  }

  if (loading) {
    return (
      <GlassCard className="flex flex-col h-full" padding={false}>
        <div className="p-5 pb-0">
          <div className="flex items-baseline justify-between mb-4">
            <div className="shimmer h-4 w-28 rounded" />
            <div className="shimmer h-7 w-24 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-gray-50/80 rounded-lg p-3">
                <div className="shimmer h-3 w-20 rounded mx-auto mb-2" />
                <div className="shimmer h-5 w-16 rounded mx-auto mb-1" />
                <div className="shimmer h-2 w-24 rounded mx-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 px-5 pb-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="shimmer h-3 w-32 rounded" />
              <div className="flex gap-4">
                <div className="shimmer h-3 w-12 rounded" />
                <div className="shimmer h-3 w-8 rounded" />
                <div className="shimmer h-3 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col h-full" padding={false}>
      <div className="p-5 pb-0">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Cost & Economics
          </h3>
          <div className="text-right">
            <span className="text-2xl font-semibold text-gray-900 tabular-nums">
              ${totalPlatformCost.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 ml-1">total*</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {summaryCards.map((c) => (
            <div
              key={c.segment}
              className="bg-gray-50/80 rounded-lg p-3 text-center"
            >
              <p className="text-[11px] text-gray-400 font-medium">
                {c.segment}
              </p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">
                ${c.cost.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-400">
                {c.count} orgs &middot; {c.users} users
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 border-b border-gray-100">
          {COST_SEGMENTS.map((seg) => (
            <button
              key={seg}
              onClick={() => setActiveTab(seg)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
                activeTab === seg
                  ? "bg-white text-gray-900 border border-b-0 border-gray-200"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {seg}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-4">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/95">
            <tr>
              <th
                className="text-left px-3 py-2 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none"
                onClick={() => handleSort("name")}
              >
                Organization
                {sortKey === "name" && (
                  <span className="ml-1">
                    {sortAsc ? "\u2191" : "\u2193"}
                  </span>
                )}
              </th>
              <SortHeader k="cost" label="Cost" />
              <SortHeader k="conversations" label="Conv." />
              <SortHeader k="users" label="Users" />
            </tr>
          </thead>
          <tbody>
            {sortedOrgs.map((org) => (
              <tr
                key={org.id}
                className="border-t border-gray-50 hover:bg-gray-50/50"
              >
                <td className="px-3 py-2 text-gray-800">{org.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                  ${org.costTotal.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                  {org.conversations}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                  {org.usersCount}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 font-semibold">
              <td className="px-3 py-2 text-gray-900">Total</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                ${tabTotals.cost.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                {tabTotals.conversations}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                {tabTotals.users}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2 border-t border-gray-100">
        <p className="text-[10px] text-gray-400">
          * Total platform cost across all segments
        </p>
      </div>
    </GlassCard>
  );
}
