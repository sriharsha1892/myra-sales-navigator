"use client";

export function SkeletonKpi() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5"
        >
          <div className="shimmer h-3 w-24 rounded mb-3" />
          <div className="shimmer h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonSection({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5">
      <div className="shimmer h-4 w-32 rounded mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="shimmer h-3 w-28 rounded" />
            <div className="shimmer h-3 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
