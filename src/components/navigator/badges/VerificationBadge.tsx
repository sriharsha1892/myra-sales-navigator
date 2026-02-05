"use client";

import { cn } from "@/lib/cn";
import type { Contact } from "@/lib/navigator/types";
import { Tooltip } from "@/components/navigator/shared/Tooltip";

interface VerificationBadgeProps {
  status: Contact["verificationStatus"];
  safeToSend?: boolean;
  className?: string;
}

const tooltips: Record<string, string> = {
  unverified: "Not yet verified by Clearout. Verify at export.",
  verified: "Clearout confirmed this email is deliverable.",
  valid_risky: "Email exists but may have issues (catch-all domain or temporary inbox).",
  invalid: "Clearout flagged this email as undeliverable. Do not send.",
  unknown: "Verification returned an inconclusive result.",
};

export function VerificationBadge({ status, safeToSend, className }: VerificationBadgeProps) {
  if (!status || status === "unverified") {
    return (
      <Tooltip text={tooltips.unverified}>
        <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-warning/10 text-warning", className)}>
          Unverified
        </span>
      </Tooltip>
    );
  }

  if (status === "valid" && safeToSend) {
    return (
      <Tooltip text={tooltips.verified}>
        <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-success-light text-success", className)}>
          Verified &#x2713;
        </span>
      </Tooltip>
    );
  }

  if (status === "valid" || status === "valid_risky") {
    return (
      <Tooltip text={tooltips.valid_risky}>
        <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-warning/10 text-warning", className)}>
          Valid (risky)
        </span>
      </Tooltip>
    );
  }

  if (status === "invalid") {
    return (
      <Tooltip text={tooltips.invalid}>
        <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-danger/10 text-danger", className)}>
          Invalid &#x2717;
        </span>
      </Tooltip>
    );
  }

  // "unknown"
  return (
    <Tooltip text={tooltips.unknown}>
      <span className={cn("rounded-pill px-1.5 py-0.5 text-[9px] font-medium bg-surface-2 text-text-tertiary", className)}>
        Unknown
      </span>
    </Tooltip>
  );
}
