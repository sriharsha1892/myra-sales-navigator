"use client";

import { useGtmUpdates, useGtmSnapshots } from "@/hooks/useGtmDashboardData";
import { sanitizeHtml } from "@/lib/gtm-dashboard/sanitize";

export function UpdatesPanel() {
  const { data: updates, isLoading, isError } = useGtmUpdates();
  const { data: snapshots } = useGtmSnapshots();

  const snapshotMap = new Map(
    (snapshots ?? []).map((s) => [s.id, s])
  );

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">
            Failed to load updates. Try refreshing.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-6 space-y-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="shimmer h-4 w-28 rounded-full" />
              <div className="shimmer h-3 w-20 rounded" />
            </div>
            <div className="space-y-2">
              <div className="shimmer h-3 w-full rounded" />
              <div className="shimmer h-3 w-3/4 rounded" />
              <div className="shimmer h-3 w-5/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!updates || updates.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No updates yet
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {updates.map((update) => {
        const snapshot = update.snapshotId
          ? snapshotMap.get(update.snapshotId)
          : null;
        return (
          <article
            key={update.id}
            className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              {snapshot && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  {snapshot.label}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {new Date(update.createdAt).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div
              className="prose prose-sm prose-gray max-w-none [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-2 [&_ul]:space-y-1 [&_li]:text-sm"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(update.content) }}
            />
          </article>
        );
      })}
    </div>
  );
}
