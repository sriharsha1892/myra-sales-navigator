"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import type { RateLimitSettings } from "@/lib/types";

const DEFAULT_SOURCES = ["exa", "apollo", "hubspot", "clearout"];

export function RateLimitSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.rateLimits;

  const update = (partial: Partial<RateLimitSettings>) => {
    updateConfig({ rateLimits: { ...settings, ...partial } });
  };

  const updateSource = (source: string, field: "maxPerMin" | "warningAt", value: number) => {
    const current = settings.perSource[source] || { maxPerMin: 60, warningAt: 50 };
    update({
      perSource: {
        ...settings.perSource,
        [source]: { ...current, [field]: value },
      },
    });
  };

  return (
    <AdminSection title="Rate Limits">
      <div className="space-y-4">
        <div className="space-y-3">
          {DEFAULT_SOURCES.map((source) => {
            const cfg = settings.perSource[source] || { maxPerMin: 60, warningAt: 50 };
            return (
              <div key={source} className="rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
                <span className="text-xs font-medium capitalize text-text-primary">{source}</span>
                <div className="mt-2 flex gap-4">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-text-tertiary">Max/min</label>
                    <input
                      type="number"
                      value={cfg.maxPerMin}
                      onChange={(e) => updateSource(source, "maxPerMin", parseInt(e.target.value) || 0)}
                      className="w-20 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-text-tertiary">Warn at</label>
                    <input
                      type="number"
                      value={cfg.warningAt}
                      onChange={(e) => updateSource(source, "warningAt", parseInt(e.target.value) || 0)}
                      className="w-20 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">Slack Webhook URL</label>
          <input
            type="text"
            value={settings.slackWebhookUrl || ""}
            onChange={(e) => update({ slackWebhookUrl: e.target.value || null })}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">Alert Recipients</label>
          <p className="text-[10px] text-text-tertiary">
            {settings.alertRecipients.length === 0
              ? "No recipients configured"
              : settings.alertRecipients.join(", ")}
          </p>
        </div>
      </div>
    </AdminSection>
  );
}
