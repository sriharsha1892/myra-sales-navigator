"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { AuthSettings } from "@/lib/navigator/types";

const SESSION_DURATION_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
];

const MAGIC_LINK_EXPIRY_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 480, label: "8 hours" },
  { value: 1440, label: "24 hours" },
];

export function AuthSettingsSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.authSettings;

  const update = (partial: Partial<AuthSettings>) => {
    updateConfig({ authSettings: { ...settings, ...partial } });
  };

  return (
    <AdminSection title="Auth Settings">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Session Duration
          </label>
          <select
            value={settings.sessionDurationDays ?? 30}
            onChange={(e) => update({ sessionDurationDays: parseInt(e.target.value) })}
            className="w-40 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          >
            {SESSION_DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-text-tertiary">
            How long a user stays logged in. Session refreshes on every page load.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Magic Link Expiry
          </label>
          <select
            value={settings.magicLinkExpiryMinutes ?? 60}
            onChange={(e) => update({ magicLinkExpiryMinutes: parseInt(e.target.value) })}
            className="w-40 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          >
            {MAGIC_LINK_EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-text-tertiary">
            How long login links remain valid after generation.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Session Timeout (minutes)
          </label>
          <input
            type="number"
            min={15}
            max={43200}
            value={settings.sessionTimeoutMinutes}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (isNaN(val)) return;
              update({ sessionTimeoutMinutes: Math.max(15, Math.min(43200, val)) });
            }}
            className="w-28 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-text-tertiary">
            Inactivity timeout (15–43200 min). Default: 480 (8 hours).
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Welcome Message
          </label>
          <input
            type="text"
            value={settings.welcomeMessage}
            onChange={(e) => update({ welcomeMessage: e.target.value })}
            placeholder="Welcome to myRA Sales Navigator"
            className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-text-tertiary">
            Displayed on the login page.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
            Microsoft Teams Webhook URL
          </label>
          <input
            type="url"
            value={settings.teamsWebhookUrl ?? ""}
            onChange={(e) => update({ teamsWebhookUrl: e.target.value || undefined })}
            placeholder="https://outlook.office.com/webhook/..."
            className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-text-tertiary">
            Optional. Enables &quot;Send via Teams&quot; button next to login links.
          </p>
        </div>
      </div>
    </AdminSection>
  );
}
