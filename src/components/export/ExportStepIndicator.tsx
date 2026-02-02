"use client";

interface ExportStepIndicatorProps {
  step: 1 | 2 | 3;
}

const steps = ["Select contacts", "Verify emails", "Export"];

export function ExportStepIndicator({ step }: ExportStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-6 py-2">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === step;
        const isPast = stepNum < step;
        return (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isActive || isPast
                  ? "bg-accent-primary"
                  : "border border-surface-3 bg-transparent"
              }`}
            />
            <span
              className={`text-[10px] ${
                isActive
                  ? "font-semibold text-text-primary"
                  : isPast
                    ? "text-text-secondary"
                    : "text-text-tertiary"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
