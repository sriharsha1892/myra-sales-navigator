"use client";

interface KpiData {
  exportsThisWeek: number;
  prospectsDiscovered: number;
  activeUsers: number;
  avgIcpScore: number;
}

interface KpiTargets {
  exportsThisWeek: number;
  avgIcpScore: number;
}

const DEFAULT_TARGETS: KpiTargets = { exportsThisWeek: 20, avgIcpScore: 60 };

const CARD_DEFS = [
  { key: "exportsThisWeek" as const, label: "Exports This Week", targetKey: "exportsThisWeek" as const },
  { key: "prospectsDiscovered" as const, label: "Prospects Discovered", targetKey: null },
  { key: "activeUsers" as const, label: "Active Users", targetKey: null },
  { key: "avgIcpScore" as const, label: "Avg ICP Score", targetKey: "avgIcpScore" as const },
];

interface WeeklyKpiCardsProps {
  data: KpiData | null;
  targets?: KpiTargets;
}

export function WeeklyKpiCards({ data, targets }: WeeklyKpiCardsProps) {
  const t = { ...DEFAULT_TARGETS, ...targets };

  if (!data) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {CARD_DEFS.map((c) => (
          <div key={c.key} className="shimmer h-24 rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {CARD_DEFS.map((card) => {
        const value = data[card.key];
        const target = card.targetKey ? t[card.targetKey] : null;
        const atTarget = target !== null && value >= target;
        const belowTarget = target !== null && value < target;

        return (
          <div
            key={card.key}
            className="rounded-card border border-surface-3 bg-surface-1 p-4"
          >
            <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
              {card.label}
            </p>
            <p className="mt-2 font-mono text-2xl text-text-primary">{value}</p>
            {target !== null && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-1 flex-1 rounded-full bg-surface-3">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      atTarget ? "bg-success" : "bg-accent-primary"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((value / target) * 100))}%`,
                    }}
                  />
                </div>
                <span
                  className={`text-[10px] font-mono ${
                    atTarget
                      ? "text-success"
                      : belowTarget
                        ? "text-accent-primary"
                        : "text-text-tertiary"
                  }`}
                >
                  {target}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
