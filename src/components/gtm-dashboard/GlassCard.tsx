"use client";

import { cn } from "@/lib/cn";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function GlassCard({
  children,
  className,
  padding = true,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
        padding && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
