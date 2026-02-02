"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import { defaultFreshsalesSettings } from "@/lib/mock-data";
import type { FreshsalesStatus } from "@/lib/types";

const STATUS_KEYS: FreshsalesStatus[] = [
  "none",
  "new_lead",
  "contacted",
  "negotiation",
  "won",
  "customer",
  "lost",
];

export function FreshsalesSettingsSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.freshsalesSettings;

  const update = (patch: Partial<typeof settings>) => {
    updateConfig({ freshsalesSettings: { ...settings, ...patch } });
  };

  return (
    <AdminSection
      title="Freshsales Settings"
      description="Configure Freshsales (traditional research CRM) integration. Read-only — never posts back to Freshsales."
    >
      <div className="space-y-6">
        {/* Connection */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Connection
          </h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">
                Enable Freshsales integration
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="w-24 text-xs text-text-secondary">Domain</span>
              <input
                type="text"
                value={settings.domain}
                onChange={(e) => update({ domain: e.target.value })}
                placeholder="mordorintelligence"
                className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
              />
              <span className="text-[10px] text-text-tertiary">
                .freshsales.io
              </span>
            </div>
          </div>
        </div>

        {/* Display Labels */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Display Labels
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs text-text-secondary">
                Section Title
              </span>
              <input
                type="text"
                value={settings.sectionTitle}
                onChange={(e) => update({ sectionTitle: e.target.value })}
                className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-32 text-xs text-text-secondary">
                Empty State
              </span>
              <input
                type="text"
                value={settings.emptyStateLabel}
                onChange={(e) => update({ emptyStateLabel: e.target.value })}
                className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Status Labels */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Status Labels
          </h4>
          <div className="space-y-2">
            {STATUS_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-32 font-mono text-[10px] text-text-tertiary">
                  {key}
                </span>
                <input
                  type="text"
                  value={settings.statusLabels[key]}
                  onChange={(e) =>
                    update({
                      statusLabels: {
                        ...settings.statusLabels,
                        [key]: e.target.value,
                      },
                    })
                  }
                  className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Dossier Visibility */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Dossier Visibility
          </h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showDeals}
                onChange={(e) => update({ showDeals: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">Show Deals</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showContacts}
                onChange={(e) => update({ showContacts: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">
                Show Contacts
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showActivity}
                onChange={(e) => update({ showActivity: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">
                Show Recent Activity
              </span>
            </label>
          </div>
        </div>

        {/* Engagement Alert */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Engagement Alert
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">
              Highlight if research team contacted within
            </span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.recentActivityDaysThreshold}
              onChange={(e) =>
                update({
                  recentActivityDaysThreshold: parseInt(e.target.value) || 30,
                })
              }
              className="w-16 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-center font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
            <span className="text-xs text-text-secondary">days</span>
          </div>
        </div>

        {/* Cache TTL */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Cache TTL
          </h4>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={120}
              value={settings.cacheTtlMinutes}
              onChange={(e) =>
                update({ cacheTtlMinutes: parseInt(e.target.value) })
              }
              className="flex-1 accent-accent-primary"
            />
            <span className="w-20 text-right font-mono text-xs text-text-secondary">
              {settings.cacheTtlMinutes} min
            </span>
          </div>
        </div>

        {/* ICP Scoring */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            ICP Scoring
          </h4>
          <div className="space-y-3">
            {(
              [
                { key: "freshsalesLead", label: "Freshsales Lead" },
                { key: "freshsalesCustomer", label: "Freshsales Customer" },
                {
                  key: "freshsalesRecentContact",
                  label: "Recent Contact",
                },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-40 text-xs text-text-secondary">
                  {label}
                </span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={settings.icpWeights[key]}
                  onChange={(e) =>
                    update({
                      icpWeights: {
                        ...settings.icpWeights,
                        [key]: parseInt(e.target.value),
                      },
                    })
                  }
                  className="flex-1 accent-accent-primary"
                />
                <input
                  type="number"
                  value={settings.icpWeights[key]}
                  onChange={(e) =>
                    update({
                      icpWeights: {
                        ...settings.icpWeights,
                        [key]: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-16 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-center font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => updateConfig({ freshsalesSettings: defaultFreshsalesSettings })}
        className="mt-4 text-xs text-text-tertiary hover:text-text-secondary"
      >
        Reset to Defaults
      </button>
    </AdminSection>
  );
}
