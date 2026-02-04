"use client";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <h3 className="mb-1 text-sm font-medium text-text-secondary">{title}</h3>
      <p className="max-w-xs text-sm text-text-tertiary">{description}</p>
    </div>
  );
}
