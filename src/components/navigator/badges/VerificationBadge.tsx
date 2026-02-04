"use client";

import { cn } from "@/lib/cn";
import type { Contact } from "@/lib/navigator/types";

interface VerificationBadgeProps {
  status: Contact["verificationStatus"];
  safeToSend?: boolean;
  className?: string;
}

export function VerificationBadge({ status, safeToSend, className }: VerificationBadgeProps) {
  if (!status || status === "unverified") {
    return (
      <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-warning/10 text-warning", className)}>
        Unverified
      </span>
    );
  }

  if (status === "valid" && safeToSend) {
    return (
      <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-success-light text-success", className)}>
        Verified &#x2713;
      </span>
    );
  }

  if (status === "valid" || status === "valid_risky") {
    return (
      <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-warning/10 text-warning", className)}>
        Valid (risky)
      </span>
    );
  }

  if (status === "invalid") {
    return (
      <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-danger/10 text-danger", className)}>
        Invalid &#x2717;
      </span>
    );
  }

  // "unknown"
  return (
    <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-surface-2 text-text-tertiary", className)}>
      Unknown
    </span>
  );
}
