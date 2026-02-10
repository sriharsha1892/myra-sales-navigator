"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface SkeletonCardProps {
  className?: string;
}

export const SkeletonCard = React.memo(function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn("rounded-card border-[1.5px] border-surface-3 bg-surface-1 px-4 py-3", className)}>
      <div className="flex items-start gap-2.5">
        {/* Checkbox + status */}
        <div className="mt-1 flex flex-col items-center gap-1">
          <div className="shimmer h-3.5 w-3.5 rounded" />
          <div className="shimmer h-3 w-3 rounded" />
        </div>
        {/* Logo */}
        <div className="shimmer mt-0.5 h-5 w-5 flex-shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-2">
          {/* Name + ICP badge */}
          <div className="flex items-center justify-between">
            <div className="shimmer h-5 w-36 rounded" />
            <div className="flex items-center gap-1.5">
              <div className="shimmer h-5 w-8 rounded-badge" />
              <div className="shimmer h-3 w-3 rounded" />
            </div>
          </div>
          {/* CRM status pill */}
          <div className="flex items-center gap-1.5">
            <div className="shimmer h-4 w-20 rounded-pill" />
          </div>
          {/* Meta row: industry, emp count, location */}
          <div className="flex items-center gap-2">
            <div className="shimmer h-3.5 w-20 rounded" />
            <div className="shimmer h-3.5 w-16 rounded" />
            <div className="shimmer h-3.5 w-24 rounded" />
          </div>
          {/* Description */}
          <div className="shimmer h-3 w-full rounded" />
          {/* Signal pill */}
          <div className="flex items-center gap-1.5">
            <div className="shimmer h-4 w-14 rounded-pill" />
            <div className="shimmer h-3 w-32 rounded" />
          </div>
          {/* Bottom row: source badges + contact count */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="shimmer h-4 w-4 rounded" />
              <div className="shimmer h-4 w-4 rounded" />
            </div>
            <div className="ml-auto shimmer h-3.5 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
});
