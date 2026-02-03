"use client";

import { useGtmSnapshots } from "@/hooks/useGtmDashboardData";
import { SnapshotSwitcher } from "./SnapshotSwitcher";

interface DashboardHeaderProps {
  activeTab: "dashboard" | "updates";
  onTabChange: (tab: "dashboard" | "updates") => void;
  snapshotId: string | null;
  onSnapshotChange: (id: string | null) => void;
}

export function DashboardHeader({
  activeTab,
  onTabChange,
  snapshotId,
  onSnapshotChange,
}: DashboardHeaderProps) {
  const { data: snapshots } = useGtmSnapshots();
  const prevSnapshot = snapshots?.[0];
  const prevDate = prevSnapshot
    ? new Date(prevSnapshot.createdAt).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-white/50">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-gray-900">myRA GTM</h1>
        {prevDate && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Changes since {prevDate}
          </span>
        )}
        <div className="flex bg-gray-100 rounded-lg p-0.5 ml-4">
          <button
            onClick={() => onTabChange("dashboard")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === "dashboard"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onTabChange("updates")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === "updates"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Updates
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">
          Data as of {new Date().toLocaleDateString()}
        </span>
        <SnapshotSwitcher
          selectedId={snapshotId}
          onSelect={onSnapshotChange}
        />
      </div>
    </header>
  );
}
