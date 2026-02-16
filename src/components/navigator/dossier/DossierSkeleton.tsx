"use client";

export function DossierSkeleton() {
  return (
    <div className="h-full w-[420px] flex-shrink-0 bg-surface-0 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="border-b border-surface-3 px-4 py-2.5">
        <div className="shimmer h-3.5 w-40 rounded" />
      </div>

      {/* Compact header skeleton */}
      <div className="border-b border-surface-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="shimmer h-5 w-44 rounded" />
          <div className="shimmer h-5 w-10 rounded-pill" />
          <div className="shimmer h-2 w-2 rounded-full" />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="shimmer h-3 w-28 rounded" />
          <div className="shimmer h-3 w-16 rounded" />
        </div>
      </div>

      {/* Contacts hero skeleton */}
      <div className="border-t border-surface-3 px-4 pt-3 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="shimmer h-3 w-20 rounded" />
          <div className="shimmer h-3 w-8 rounded" />
          <div className="ml-auto flex gap-1">
            <div className="shimmer h-5 w-16 rounded-pill" />
            <div className="shimmer h-5 w-16 rounded-pill" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer h-16 w-full rounded-card" />
          ))}
        </div>
      </div>

      {/* Collapsible section placeholders */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border-t border-surface-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="shimmer h-3 w-3 rounded" />
            <div className="shimmer h-3 w-28 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
