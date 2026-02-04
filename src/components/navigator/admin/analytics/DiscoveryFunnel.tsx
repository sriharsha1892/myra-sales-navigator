"use client";

import { AdminSection } from "../AdminSection";

interface FunnelData {
  searches: number;
  companiesViewed: number;
  contactsExtracted: number;
}

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

export function DiscoveryFunnel({ data }: { data: FunnelData | null }) {
  if (!data) {
    return (
      <AdminSection title="Discovery Funnel">
        <div className="shimmer h-32 rounded-card" />
      </AdminSection>
    );
  }

  const max = Math.max(data.searches, 1);
  const steps = [
    { label: "Searches", value: data.searches, conversion: null },
    {
      label: "Companies Viewed",
      value: data.companiesViewed,
      conversion: pct(data.companiesViewed, data.searches),
    },
    {
      label: "Contacts Extracted",
      value: data.contactsExtracted,
      conversion: pct(data.contactsExtracted, data.companiesViewed),
    },
  ];

  return (
    <AdminSection title="Discovery Funnel">
      {data.searches === 0 ? (
        <p className="text-xs text-text-tertiary">No search data available yet.</p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-text-secondary">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-text-primary">
                    {step.value}
                  </span>
                  {step.conversion && (
                    <span className="text-[10px] text-text-tertiary">
                      ({step.conversion} conv.)
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full bg-surface-3">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(2, Math.round((step.value / max) * 100))}%`,
                    backgroundColor:
                      i === 0
                        ? "var(--color-accent-secondary)"
                        : i === 1
                          ? "var(--color-accent-primary)"
                          : "var(--color-success)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
