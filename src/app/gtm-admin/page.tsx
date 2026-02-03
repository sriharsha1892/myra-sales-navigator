"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { isGtmAuthed, setGtmAuthed } from "@/lib/gtm-dashboard/auth";
import { PinAuthModal } from "@/components/gtm-dashboard/PinAuthModal";
import { AdminTabs, type AdminTab } from "./_components/AdminTabs";

const PipelineTab = lazy(() =>
  import("./_components/tabs/PipelineTab").then((m) => ({
    default: m.PipelineTab,
  }))
);
const CostTab = lazy(() =>
  import("./_components/tabs/CostTab").then((m) => ({ default: m.CostTab }))
);
const LeadGenTab = lazy(() =>
  import("./_components/tabs/LeadGenTab").then((m) => ({
    default: m.LeadGenTab,
  }))
);
const UpdatesTab = lazy(() =>
  import("./_components/tabs/UpdatesTab").then((m) => ({
    default: m.UpdatesTab,
  }))
);
const SnapshotsTab = lazy(() =>
  import("./_components/tabs/SnapshotsTab").then((m) => ({
    default: m.SnapshotsTab,
  }))
);

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
    </div>
  );
}

export default function GtmAdminPage() {
  const [authed, setAuthed] = useState(() => typeof window !== "undefined" && isGtmAuthed());
  const [activeTab, setActiveTab] = useState<AdminTab>("pipeline");

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
    <div className="min-h-screen bg-gradient-to-br from-[#e8ecf3] via-[#f3eff8] to-[#edf5f2] bg-fixed">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-white/50">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            GTM Admin
          </h1>
        </div>
        <a
          href="/gtm-dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Preview Dashboard &rarr;
        </a>
      </header>

      <div className="px-6 pt-4">
        <AdminTabs active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="px-6 py-4">
        <Suspense fallback={<TabSpinner />}>
          {activeTab === "pipeline" && <PipelineTab />}
          {activeTab === "cost" && <CostTab />}
          {activeTab === "lead-gen" && <LeadGenTab />}
          {activeTab === "updates" && <UpdatesTab />}
          {activeTab === "snapshots" && <SnapshotsTab />}
        </Suspense>
      </div>
    </div>
  );
}
