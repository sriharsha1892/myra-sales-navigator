"use client";

import { useGtmSnapshots } from "@/hooks/useGtmDashboardData";

interface SnapshotSwitcherProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function SnapshotSwitcher({
  selectedId,
  onSelect,
}: SnapshotSwitcherProps) {
  const { data: snapshots } = useGtmSnapshots();
  const recent = (snapshots ?? []).slice(0, 3);

  return (
    <select
      value={selectedId ?? "current"}
      onChange={(e) =>
        onSelect(e.target.value === "current" ? null : e.target.value)
      }
      className="text-sm bg-white/60 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
    >
      <option value="current">Current</option>
      {recent.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label} ({new Date(s.createdAt).toLocaleDateString()})
        </option>
      ))}
    </select>
  );
}
