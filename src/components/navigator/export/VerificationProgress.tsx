"use client";

import { Overlay } from "@/components/primitives/Overlay";
import { ExportStepIndicator } from "./ExportStepIndicator";
import type { ExportFlowState } from "@/lib/navigator/types";

interface VerificationProgressProps {
  exportState: ExportFlowState;
}

export function VerificationProgress({ exportState }: VerificationProgressProps) {
  const { verifiedCount, totalCount } = exportState;
  const pct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  return (
    <Overlay open={true} onClose={() => {}} backdrop="blur" placement="center">
      <div className="w-full max-w-xs rounded-card border border-surface-3 bg-surface-1 p-6 shadow-2xl">
        <ExportStepIndicator step={2} />
        <p className="mb-4 text-sm font-medium text-text-primary">
          Verifying {totalCount} email{totalCount !== 1 ? "s" : ""}...
        </p>

        {/* Progress bar */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent-primary transition-all duration-[var(--transition-default)] ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-center font-mono text-xs text-text-tertiary">
          {verifiedCount} / {totalCount} verified
        </p>
      </div>
    </Overlay>
  );
}
