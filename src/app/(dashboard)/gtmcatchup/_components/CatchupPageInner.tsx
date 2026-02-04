"use client";

import { useState } from "react";
import { isGtmAuthed, setGtmAuthed } from "@/lib/gtm-dashboard/auth";
import { PinAuthModal } from "@/components/gtm-dashboard/PinAuthModal";
import { useV2Entries } from "@/hooks/dashboard/useGtmV2";
import { formatEntryDate } from "@/lib/gtm/v2-utils";
import { KpiStrip } from "@/components/gtm/v2/KpiStrip";
import { PipelineSection } from "@/components/gtm/v2/PipelineSection";
import { LeadGenSection } from "@/components/gtm/v2/LeadGenSection";
import { CostSection } from "@/components/gtm/v2/CostSection";
import { AmDemoSection } from "@/components/gtm/v2/AmDemoSection";
import { AgendaPanel } from "@/components/gtm/v2/AgendaPanel";
import { SkeletonKpi, SkeletonSection } from "@/components/gtm/v2/SkeletonCards";

export default function CatchupPageInner() {
  const [authed, setAuthed] = useState(() => isGtmAuthed());

  const {
    data: entriesData,
    isLoading: entriesLoading,
    isError: entriesError,
  } = useV2Entries();

  const latest = entriesData?.latest ?? null;
  const previous = entriesData?.previous ?? null;

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
      {/* Level 1: Header */}
      <div className="border-b border-gray-200/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              GTM Catchup
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {latest && (
                <p className="text-xs text-gray-500">
                  Last entry: {formatEntryDate(latest.entryDate)}
                  {previous && (
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
                      Changes since {formatEntryDate(previous.entryDate)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/gtmcatchup/entry"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Edit Data
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {entriesError ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-2">
              Failed to load data. Try refreshing.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Refresh page
            </button>
          </div>
        ) : entriesLoading ? (
          <div className="space-y-4">
            <SkeletonKpi />
            <SkeletonSection rows={5} />
            <SkeletonSection rows={3} />
          </div>
        ) : !latest ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 mb-4">
              No entries yet. Create your first entry to see the dashboard.
            </p>
            <a
              href="/gtmcatchup/entry"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors inline-block"
            >
              Create First Entry
            </a>
          </div>
        ) : (
          <>
            {/* Level 2: KPI Strip */}
            <KpiStrip latest={latest} previous={previous} />

            {/* Level 3: Pipeline Overview */}
            <PipelineSection latest={latest} previous={previous} />

            {/* Level 4: Lead Generation */}
            <LeadGenSection latest={latest} previous={previous} />

            {/* Level 5: Cost Economics */}
            <CostSection latest={latest} previous={previous} />

            {/* Level 6: AM Demo Performance */}
            <AmDemoSection latest={latest} />

            {/* Level 7: Agenda Panel */}
            <AgendaPanel latest={latest} previous={previous} />
          </>
        )}
      </div>
    </div>
  );
}
