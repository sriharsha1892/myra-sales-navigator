"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";

export function CacheSettingsSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);

  const fields: { key: keyof typeof config.cacheDurations; label: string }[] = [
    { key: "exa", label: "Exa" },
    { key: "apollo", label: "Apollo" },
    { key: "hubspot", label: "HubSpot" },
    { key: "clearout", label: "Clearout" },
  ];

  const handleChange = (key: keyof typeof config.cacheDurations, value: number) => {
    updateConfig({ cacheDurations: { ...config.cacheDurations, [key]: value } });
  };

  return (
    <AdminSection title="Data Freshness" description="How long the app remembers data before checking for updates. Longer = faster but data may be stale.">
      <div className="space-y-3">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-24 text-xs text-text-secondary">{label}</span>
            <input
              type="range"
              min={5}
              max={1440}
              value={config.cacheDurations[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value))}
              className="flex-1 accent-accent-primary"
            />
            <span className="w-20 text-right font-mono text-xs text-text-secondary">
              {config.cacheDurations[key]} minutes
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          useStore.getState().addToast({ message: "Cache cleared (mock)", type: "success" });
        }}
        className="mt-3 rounded-input border border-surface-3 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      >
        Clear All Cache
      </button>
    </AdminSection>
  );
}
