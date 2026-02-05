"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import { defaultFreshsalesSettings } from "@/lib/navigator/mock-data";
import type { FreshsalesStatus } from "@/lib/navigator/types";

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
      description="Configure Freshsales CRM integration. Read + write (with confirmation) operations available."
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

        {/* Owner & Tags */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Owner & Tags
          </h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showOwner ?? true}
                onChange={(e) => update({ showOwner: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">Show CRM owner in dossier and cards</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showTags ?? true}
                onChange={(e) => update({ showTags: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">Show contact tags</span>
            </label>
          </div>
        </div>

        {/* Tag Scoring */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Tag Scoring
          </h4>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-text-secondary">Boost tags (comma-separated)</span>
              <input
                type="text"
                value={(settings.tagScoringRules?.boostTags || []).join(", ")}
                onChange={(e) =>
                  update({
                    tagScoringRules: {
                      ...(settings.tagScoringRules || { boostTags: [], boostPoints: 15, penaltyTags: [], penaltyPoints: -20, excludeTags: [] }),
                      boostTags: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
                    },
                  })
                }
                placeholder="decision maker, champion, key contact"
                className="mt-1 w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
              />
            </div>
            <div>
              <span className="text-xs text-text-secondary">Penalty tags (comma-separated)</span>
              <input
                type="text"
                value={(settings.tagScoringRules?.penaltyTags || []).join(", ")}
                onChange={(e) =>
                  update({
                    tagScoringRules: {
                      ...(settings.tagScoringRules || { boostTags: [], boostPoints: 15, penaltyTags: [], penaltyPoints: -20, excludeTags: [] }),
                      penaltyTags: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
                    },
                  })
                }
                placeholder="churned, bad fit, competitor"
                className="mt-1 w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
              />
            </div>
            <div>
              <span className="text-xs text-text-secondary">Auto-exclude tags (comma-separated)</span>
              <input
                type="text"
                value={(settings.tagScoringRules?.excludeTags || []).join(", ")}
                onChange={(e) =>
                  update({
                    tagScoringRules: {
                      ...(settings.tagScoringRules || { boostTags: [], boostPoints: 15, penaltyTags: [], penaltyPoints: -20, excludeTags: [] }),
                      excludeTags: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
                    },
                  })
                }
                placeholder="dnc, do not contact, unsubscribed"
                className="mt-1 w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Deal Velocity */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Deal Velocity
          </h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showDealVelocity ?? true}
                onChange={(e) => update({ showDealVelocity: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">Show days-in-stage on deals</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Stalled threshold</span>
              <input
                type="number"
                min={7}
                max={90}
                value={settings.stalledDealThresholdDays ?? 30}
                onChange={(e) => update({ stalledDealThresholdDays: parseInt(e.target.value) || 30 })}
                className="w-16 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-center font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
              <span className="text-xs text-text-secondary">days</span>
            </div>
          </div>
        </div>

        {/* Write Operations */}
        <div>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Write Operations
          </h4>
          <p className="mb-2 text-[10px] text-text-tertiary">Enable pushing data back to Freshsales. All writes require user confirmation.</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.enablePushContact ?? true}
                onChange={(e) => update({ enablePushContact: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">Enable &quot;Add to CRM&quot; on contact cards</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.enableTaskCreation ?? true}
                onChange={(e) => update({ enableTaskCreation: e.target.checked })}
                className="accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">Enable task creation from dossier</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Default task due date</span>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.defaultTaskDueDays ?? 3}
                onChange={(e) => update({ defaultTaskDueDays: parseInt(e.target.value) || 3 })}
                className="w-16 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-center font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
              <span className="text-xs text-text-secondary">business days</span>
            </div>
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
                { key: "freshsalesRecentContact", label: "Recent Contact" },
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
