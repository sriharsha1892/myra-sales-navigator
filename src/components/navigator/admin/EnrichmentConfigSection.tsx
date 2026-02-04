"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";

export function EnrichmentConfigSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const limits = config.enrichmentLimits;

  const fields: { key: keyof typeof limits; label: string; description: string; min: number; max: number }[] = [
    {
      key: "maxSearchEnrich",
      label: "Max companies to enrich at search",
      description: "Apollo enrichments per search. Each costs 1 Apollo credit. Rest enrich on click.",
      min: 0,
      max: 25,
    },
    {
      key: "maxContactAutoEnrich",
      label: "Max contacts to auto-enrich",
      description: "Top N contacts by seniority get auto-enriched. Rest show 'Reveal' button.",
      min: 0,
      max: 25,
    },
    {
      key: "maxClearoutFinds",
      label: "Max Clearout email finds per company",
      description: "Clearout email finder fallback when Apollo has no email. 1 credit each.",
      min: 0,
      max: 20,
    },
  ];

  const handleChange = (key: keyof typeof limits, value: number) => {
    updateConfig({ enrichmentLimits: { ...limits, [key]: value } });
  };

  return (
    <AdminSection
      title="Enrichment Limits"
      description="Controls API credit spend per search and per company. Lower values save credits; higher values show richer data upfront."
    >
      <div className="space-y-4">
        {fields.map(({ key, label, description, min, max }) => (
          <div key={key}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-primary">{label}</span>
              <input
                type="number"
                min={min}
                max={max}
                value={limits[key]}
                onChange={(e) => handleChange(key, Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
                className="w-16 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-center font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={limits[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value))}
              className="mt-1 w-full accent-accent-primary"
            />
            <p className="mt-0.5 text-xs text-text-tertiary">{description}</p>
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          updateConfig({
            enrichmentLimits: { maxSearchEnrich: 10, maxContactAutoEnrich: 5, maxClearoutFinds: 10 },
          })
        }
        className="mt-3 text-xs text-text-tertiary hover:text-text-secondary"
      >
        Reset to Defaults
      </button>
    </AdminSection>
  );
}
