"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface CompanyLogoProps {
  logoUrl?: string | null;
  domain?: string;
  name?: string;
  size?: number;
  className?: string;
}

export function CompanyLogo({ logoUrl, domain, name, size = 20, className }: CompanyLogoProps) {
  const [error, setError] = useState(false);
  const src = logoUrl ?? (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}` : null);
  const initial = (name ?? domain ?? "?")[0]?.toUpperCase() ?? "?";

  if (!src || error) {
    return (
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded bg-surface-2 font-display text-text-tertiary",
          className
        )}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        aria-hidden="true"
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("flex-shrink-0 rounded", className)}
      onError={() => setError(true)}
    />
  );
}
