"use client";

export function DossierSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-surface-3 px-4 py-3">
        <div className="shimmer h-5 w-48 rounded" />
        <div className="shimmer mt-1.5 h-3 w-32 rounded" />
        <div className="mt-2 flex gap-1.5">
          <div className="shimmer h-4 w-8 rounded-badge" />
          <div className="shimmer h-4 w-8 rounded-badge" />
        </div>
        <div className="shimmer mt-2 h-3 w-24 rounded" />
      </div>

      {/* Overview skeleton */}
      <div className="border-b border-surface-3 px-4 py-3">
        <div className="shimmer mb-2 h-3 w-20 rounded" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="shimmer h-2.5 w-16 rounded" />
              <div className="shimmer mt-1 h-3.5 w-28 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Signals skeleton */}
      <div className="border-b border-surface-3 px-4 py-3">
        <div className="shimmer mb-2 h-3 w-16 rounded" />
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer h-10 w-full rounded-card" />
          ))}
        </div>
      </div>

      {/* Contacts skeleton */}
      <div className="px-4 py-3">
        <div className="shimmer mb-2 h-3 w-24 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer h-16 w-full rounded-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
