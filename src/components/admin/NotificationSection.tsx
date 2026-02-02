"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import type { NotificationSettings } from "@/lib/types";

export function NotificationSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.notifications;

  const update = (partial: Partial<NotificationSettings>) => {
    updateConfig({ notifications: { ...settings, ...partial } });
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
          <p className="text-[10px] text-text-tertiary">
            {settings.digestRecipients.length === 0
              ? "No recipients"
              : settings.digestRecipients.join(", ")}
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
