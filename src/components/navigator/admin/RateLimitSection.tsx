"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { RateLimitSettings } from "@/lib/navigator/types";

const DEFAULT_SOURCES = ["exa", "apollo", "hubspot", "clearout", "freshsales"];

export function RateLimitSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.rateLimits;

  const [newRecipient, setNewRecipient] = useState("");

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

  const addRecipient = () => {
    const val = newRecipient.trim();
    if (!val) return;
    if (settings.alertRecipients.includes(val)) {
      setNewRecipient("");
      return;
    }
    update({ alertRecipients: [...settings.alertRecipients, val] });
    setNewRecipient("");
  };

  const removeRecipient = (recipient: string) => {
    update({ alertRecipients: settings.alertRecipients.filter((r) => r !== recipient) });
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

          {/* Tags */}
          {settings.alertRecipients.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {settings.alertRecipients.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-badge bg-surface-3 px-2 py-0.5 text-[10px] text-text-secondary"
                >
                  {r}
                  <button
                    onClick={() => removeRecipient(r)}
                    className="ml-0.5 text-text-tertiary hover:text-danger"
                    aria-label="Remove"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-2 text-[10px] italic text-text-tertiary">
              No alert recipients. Add team members who should be notified when API rate limits are approached.
            </p>
          )}

          {/* Add input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRecipient(); }}
              placeholder="Add email or name..."
              className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
            <button
              onClick={addRecipient}
              disabled={!newRecipient.trim()}
              className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-text-tertiary">
            These people will receive Slack alerts (if webhook is configured) when API usage approaches the warning threshold.
          </p>
        </div>
      </div>
    </AdminSection>
  );
}
