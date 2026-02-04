"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { NotificationSettings } from "@/lib/navigator/types";

export function NotificationSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.notifications;

  const [newRecipient, setNewRecipient] = useState("");

  const update = (partial: Partial<NotificationSettings>) => {
    updateConfig({ notifications: { ...settings, ...partial } });
  };

  const addRecipient = () => {
    const val = newRecipient.trim();
    if (!val) return;
    if (settings.digestRecipients.includes(val)) {
      setNewRecipient("");
      return;
    }
    update({ digestRecipients: [...settings.digestRecipients, val] });
    setNewRecipient("");
  };

  const removeRecipient = (recipient: string) => {
    update({ digestRecipients: settings.digestRecipients.filter((r) => r !== recipient) });
  };

  return (
    <AdminSection title="Notifications">
      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.dailyDigest}
            onChange={(e) => update({ dailyDigest: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Enable daily digest</span>
        </label>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">Digest Recipients</label>

          {/* Tags */}
          {settings.digestRecipients.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {settings.digestRecipients.map((r) => (
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
              No digest recipients. Add team members to receive the daily summary email.
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
            Daily digest includes: total searches, exports, new exclusions, and credit usage from the past 24 hours.
          </p>
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

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.alertOnRateLimit}
            onChange={(e) => update({ alertOnRateLimit: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Alert on rate limit warnings</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.alertOnKeyExpiry}
            onChange={(e) => update({ alertOnKeyExpiry: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Alert on API key expiry</span>
        </label>
      </div>
    </AdminSection>
  );
}
