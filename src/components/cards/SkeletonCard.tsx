"use client";

import { cn } from "@/lib/cn";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn("rounded-card border border-surface-3 bg-surface-1 p-4", className)}>
      <div className="flex items-start gap-2.5">
        <div className="shimmer mt-1 h-3.5 w-3.5 rounded" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="shimmer h-4 w-32 rounded" />
            <div className="shimmer h-5 w-8 rounded-badge" />
          </div>
          <div className="shimmer h-3 w-48 rounded" />
          <div className="flex gap-1">
            <div className="shimmer h-4 w-4 rounded" />
            <div className="shimmer h-4 w-4 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
