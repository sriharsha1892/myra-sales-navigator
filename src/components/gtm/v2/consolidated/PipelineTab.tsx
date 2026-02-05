"use client";

import type { GtmEntry } from "@/lib/gtm/v2-types";
import { PIPELINE_GROUPS, SEGMENT_LABELS, CHECKPOINT_COLORS } from "@/lib/gtm/v2-types";
import { cn } from "@/lib/cn";

interface Props {
  entries: GtmEntry[];
}

export function ConsolidatedPipeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
        <p className="text-sm text-gray-500">No checkpoint data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-900 mb-4">
        Pipeline by Functional Group
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">
                Segment
              </th>
              {entries.map((e, i) => (
                <th
                  key={e.entryDate}
                  className={cn(
                    "text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 border-gray-200",
                    CHECKPOINT_COLORS[i % CHECKPOINT_COLORS.length]
                  )}
                >
                  {shortDate(e.entryDate)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PIPELINE_GROUPS.map((group) => (
              <GroupRows key={group.label} group={group} entries={entries} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  entries,
}: {
  group: (typeof PIPELINE_GROUPS)[number];
  entries: GtmEntry[];
}) {
  return (
    <>
      {/* Group header */}
      <tr>
        <td
          colSpan={entries.length + 1}
          className="px-3 pt-4 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b-0"
        >
          {group.label}
        </td>
      </tr>
      {group.segments.map((seg) => {
        const vals = entries.map((e) => e.orgSnapshot?.counts?.[seg] ?? 0);
        return (
          <tr key={seg} className="border-b border-gray-100 hover:bg-gray-50/50">
            <td className="px-3 py-2.5 font-medium text-gray-900 pl-6">
              {SEGMENT_LABELS[seg]}
            </td>
            {vals.map((v, i) => {
              const prev = i > 0 ? vals[i - 1] : null;
              const d = prev !== null ? v - prev : null;
              return (
                <td
                  key={i}
                  className={cn(
                    "text-center px-3 py-2.5 font-mono",
                    CHECKPOINT_COLORS[i % CHECKPOINT_COLORS.length]
                  )}
                >
                  {v}
                  {d !== null && d !== 0 && (
                    <span
                      className={cn(
                        "ml-1 text-[10px] font-semibold px-1 py-0.5 rounded",
                        d > 0
                          ? "text-emerald-700 bg-emerald-50"
                          : "text-red-600 bg-red-50"
                      )}
                    >
                      {d > 0 ? "+" : ""}{d}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
