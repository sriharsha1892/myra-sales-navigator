"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";

export function IcpWeightsSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const weights = config.icpWeights;

  const fields: { key: keyof typeof weights; label: string }[] = [
    { key: "verticalMatch", label: "Vertical Match" },
    { key: "sizeMatch", label: "Size Match" },
    { key: "regionMatch", label: "Region Match" },
    { key: "buyingSignals", label: "Buying Signals" },
    { key: "negativeSignals", label: "Negative Signals" },
    { key: "exaRelevance", label: "Exa Relevance" },
    { key: "hubspotLead", label: "HubSpot Lead" },
    { key: "hubspotCustomer", label: "HubSpot Customer" },
    { key: "freshsalesLead", label: "Freshsales Lead" },
    { key: "freshsalesCustomer", label: "Freshsales Customer" },
    { key: "freshsalesRecentContact", label: "Freshsales Recent Contact" },
  ];

  const handleChange = (key: keyof typeof weights, value: number) => {
    updateConfig({ icpWeights: { ...weights, [key]: value } });
  };

  const total = Object.values(weights).reduce((a, b) => a + Math.abs(b), 0);

  return (
    <AdminSection title="ICP Scoring Weights" description="Controls how companies are scored. Positive = bonus for matching, negative = penalty. The final score (0-100) appears on every company card.">
      <div className="space-y-3">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-40 text-xs text-text-secondary">{label}</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={weights[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value))}
              className="flex-1 accent-accent-primary"
            />
            <input
              type="number"
              value={weights[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value) || 0)}
              className="w-16 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-center font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-tertiary">
        Sum of absolute weights: {total}
      </p>
      <button
        onClick={() =>
          updateConfig({
            icpWeights: {
              verticalMatch: 25, sizeMatch: 20, regionMatch: 15,
              buyingSignals: 15, negativeSignals: -10, exaRelevance: 10,
              hubspotLead: 10, hubspotCustomer: 5,
              freshsalesLead: 10, freshsalesCustomer: -40, freshsalesRecentContact: 15,
            },
          })
        }
        className="mt-2 text-xs text-text-tertiary hover:text-text-secondary"
      >
        Reset to Defaults
      </button>
    </AdminSection>
  );
}
