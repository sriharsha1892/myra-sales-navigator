"use client";

import { useState, useEffect } from "react";
import { isGtmAuthed, setGtmAuthed } from "@/lib/gtm-dashboard/auth";
import { PinAuthModal } from "@/components/gtm-dashboard/PinAuthModal";
import {
  useGtmOrganizations,
  useGtmSnapshots,
  useGtmLeadGen,
  useGtmSnapshot,
} from "@/hooks/useGtmDashboardData";
import { DashboardHeader } from "./_components/DashboardHeader";
import { KpiStrip } from "./_components/KpiStrip";
import { PipelineCard } from "./_components/PipelineCard";
import { LeadGenCard } from "./_components/LeadGenCard";
import { CostEconomicsCard } from "./_components/CostEconomicsCard";
import { UpdatesPanel } from "./_components/UpdatesPanel";
import { RoadmapFooter } from "./_components/RoadmapFooter";

export default function GtmDashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "updates">(
    "dashboard"
  );
  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(isGtmAuthed());
  }, []);

  const {
    data: organizations = [],
    isLoading: orgsLoading,
    isError: orgsError,
  } = useGtmOrganizations();
  const { data: snapshots } = useGtmSnapshots();
  const { data: leadGen } = useGtmLeadGen();

  // For deltas: use snapshot before the selected one, or the most recent snapshot
  const previousSnapshotId =
    snapshotId
      ? (() => {
          const idx = (snapshots ?? []).findIndex((s) => s.id === snapshotId);
          return idx >= 0 && idx + 1 < (snapshots ?? []).length
            ? (snapshots ?? [])[idx + 1].id
            : null;
        })()
      : snapshots?.[0]?.id ?? null;

  const { data: previousSnapshot } = useGtmSnapshot(previousSnapshotId);

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
    <div className="h-screen flex flex-col bg-gradient-to-br from-[#e8ecf3] via-[#f3eff8] to-[#edf5f2] bg-fixed">
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        snapshotId={snapshotId}
        onSnapshotChange={setSnapshotId}
      />

      {activeTab === "dashboard" ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden p-6">
            {orgsError ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">
                    Failed to load data. Try refreshing.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                  >
                    Refresh page
                  </button>
                </div>
              </div>
            ) : orgsLoading ? (
              <div className="h-full flex flex-col gap-4">
                <KpiStrip organizations={[]} previousSnapshot={null} loading />
                <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr] gap-4">
                  <div className="flex flex-col gap-4 overflow-auto">
                    <PipelineCard
                      organizations={[]}
                      previousSnapshot={null}
                      loading
                    />
                    <LeadGenCard
                      leadGen={null}
                      previousSnapshot={null}
                      loading
                    />
                  </div>
                  <CostEconomicsCard organizations={[]} loading />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col gap-4">
                <KpiStrip
                  organizations={organizations}
                  previousSnapshot={previousSnapshot ?? null}
                />
                <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr] gap-4">
                  <div className="flex flex-col gap-4 overflow-auto">
                    <PipelineCard
                      organizations={organizations}
                      previousSnapshot={previousSnapshot ?? null}
                    />
                    <LeadGenCard
                      leadGen={leadGen ?? null}
                      previousSnapshot={previousSnapshot ?? null}
                    />
                  </div>
                  <CostEconomicsCard organizations={organizations} />
                </div>
              </div>
            )}
          </div>
          <RoadmapFooter />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <UpdatesPanel />
        </div>
      )}
    </div>
  );
}
