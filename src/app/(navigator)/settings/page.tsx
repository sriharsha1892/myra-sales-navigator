"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { useStore } from "@/lib/navigator/store";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";
import type { ViewMode, SortField } from "@/lib/navigator/types";

function getShortcuts(mod: string) {
  return [
    { group: "Anywhere", items: [{ keys: `${mod}K`, action: "Smart search" }, { keys: "Esc", action: "Close" }] },
    { group: "Results", items: [{ keys: "\u2191 \u2193", action: "Navigate" }, { keys: "Space", action: "Select / deselect" }, { keys: "Enter", action: "Open details" }, { keys: "/", action: "Focus filter" }] },
    { group: "Selection", items: [{ keys: `${mod}A`, action: "Select all" }, { keys: `${mod}E`, action: "Export" }, { keys: `${mod}C`, action: "Copy email" }] },
  ];
}

export default function SettingsPage() {
  const { userName, isAdmin, isLoading } = useAuth();
  const config = useStore((s) => s.adminConfig);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const sortField = useStore((s) => s.sortField);
  const setSortField = useStore((s) => s.setSortField);
  const userCopyFormat = useStore((s) => s.userCopyFormat);
  const setUserCopyFormat = useStore((s) => s.setUserCopyFormat);
  const demoMode = useStore((s) => s.demoMode);
  const setDemoMode = useStore((s) => s.setDemoMode);
  const { enabled: notificationsEnabled, permission: notifPermission, toggleEnabled } = useBrowserNotifications();

  const shortcuts = useMemo(() => {
    const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    return getShortcuts(isMac ? "\u2318" : "Ctrl+");
  }, []);

  // Workflow preference: skip reveal confirm
  const [skipReveal, setSkipReveal] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("nav_skip_reveal_confirm") === "1" : false
  );
  const [autoExport, setAutoExport] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("nav_auto_export") === "1" : false
  );

  // Outreach: per-user config
  const setUserConfig = useStore((s) => s.setUserConfig);

  const { data: userConfigData, isFetched: outreachConfigLoaded } = useQuery({
    queryKey: ["user-config"],
    queryFn: async () => {
      const res = await fetch("/api/user/config");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const [freshsalesDomain, setFreshsalesDomain] = useState("");
  const [freshsalesDomainError, setFreshsalesDomainError] = useState("");
  const [hasLinkedinSalesNav, setHasLinkedinSalesNav] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [teamsNotifEnabled, setTeamsNotifEnabled] = useState(true);
  const [teamsTestStatus, setTeamsTestStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [teamsTestMessage, setTeamsTestMessage] = useState("");
  const [configSynced, setConfigSynced] = useState(false);

  // Sync query data to local state once (not synchronous setState in effect body)
  if (userConfigData && !configSynced) {
    setFreshsalesDomain(userConfigData.freshsalesDomain ?? "");
    setHasLinkedinSalesNav(userConfigData.hasLinkedinSalesNav ?? false);
    setTeamsWebhookUrl(userConfigData.preferences?.teamsWebhookUrl ?? "");
    setTeamsNotifEnabled(userConfigData.preferences?.teamsNotificationsEnabled ?? true);
    setUserConfig(userConfigData);
    setConfigSynced(true);
  }

  const saveOutreachConfig = useCallback(async (fsDomain: string, linkedinSalesNav: boolean) => {
    const cfg = { freshsalesDomain: fsDomain || null, hasLinkedinSalesNav: linkedinSalesNav, preferences: {} };
    try {
      await fetch("/api/user/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      setUserConfig({ userName: userName ?? "", ...cfg });
    } catch { /* silent */ }
  }, [userName, setUserConfig]);

  const saveTeamsConfig = useCallback(async (webhookUrl: string, enabled: boolean) => {
    const cfg = {
      freshsalesDomain: freshsalesDomain || null,
      hasLinkedinSalesNav,
      preferences: {
        ...(userConfigData?.preferences ?? {}),
        teamsWebhookUrl: webhookUrl || null,
        teamsNotificationsEnabled: enabled,
      },
    };
    try {
      await fetch("/api/user/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      setUserConfig({ userName: userName ?? "", ...cfg });
    } catch { /* silent */ }
  }, [userName, setUserConfig, freshsalesDomain, hasLinkedinSalesNav, userConfigData]);

  const sendTeamsTestPersonal = async () => {
    if (!teamsWebhookUrl) return;
    setTeamsTestStatus("sending");
    setTeamsTestMessage("");
    try {
      const res = await fetch("/api/teams/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: teamsWebhookUrl, type: "personal" }),
      });
      if (res.ok) {
        setTeamsTestStatus("success");
        setTeamsTestMessage("Test card sent successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        setTeamsTestStatus("error");
        setTeamsTestMessage(data.error || "Failed to send test card.");
      }
    } catch {
      setTeamsTestStatus("error");
      setTeamsTestMessage("Network error sending test card.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="shimmer mx-auto h-8 w-32 rounded-card" />
      </div>
    );
  }

  const copyPreview = (() => {
    const fmt = config.copyFormats.find((f) => f.id === userCopyFormat);
    if (!fmt) return "Sarah Chen <schen@ingredion.com>";
    return fmt.template
      .replace("{name}", "Sarah Chen")
      .replace("{email}", "schen@ingredion.com")
      .replace("{title}", "VP of Procurement")
      .replace("{company}", "Ingredion")
      .replace("{phone}", "+1 555-0100");
  })();

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-8">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-text-primary">My Preferences</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {userName} &middot; {isAdmin ? "Admin" : "Account Manager"}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-input border border-surface-3 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover"
          >
            &larr; Back
          </Link>
        </div>

        {/* Defaults */}
        <Section title="Defaults">
          <div className="grid grid-cols-2 gap-4">
            <SettingField label="Default View" hint="First thing you see after a search.">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="w-full rounded-input border border-surface-3 bg-surface-2 px-2.5 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              >
                <option value="companies">Companies</option>
                <option value="exported">Exported</option>
              </select>
            </SettingField>

            <SettingField label="Default Sort" hint="How results are ordered.">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="w-full rounded-input border border-surface-3 bg-surface-2 px-2.5 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              >
                <option value="icp_score">ICP Score</option>
                <option value="name">Name</option>
                <option value="employee_count">Company Size</option>
              </select>
            </SettingField>
          </div>

          <div className="mt-4">
            <SettingField label="Copy Format" hint="What's copied when you click copy on a contact.">
              <select
                value={userCopyFormat}
                onChange={(e) => setUserCopyFormat(e.target.value)}
                className="w-full rounded-input border border-surface-3 bg-surface-2 px-2.5 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              >
                {config.copyFormats.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </SettingField>
            <div className="mt-2 rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-text-tertiary">Preview</p>
              <p className="mt-0.5 whitespace-pre-wrap font-mono text-xs text-text-secondary">{copyPreview}</p>
            </div>
          </div>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <SettingField label="Theme" hint="Dark mode only per design spec.">
            <div className="flex gap-2">
              <span className="rounded-input border border-accent-primary bg-accent-primary-light px-4 py-2 text-sm font-medium capitalize text-text-primary">
                Dark
              </span>
            </div>
          </SettingField>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              disabled={notifPermission === "denied"}
              onChange={(e) => toggleEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-surface-3 bg-surface-2 accent-accent-primary"
            />
            <div>
              <span className="text-sm font-medium text-text-primary">Browser Notifications</span>
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                {notifPermission === "denied"
                  ? "Notifications are blocked. Enable them in your browser settings for this site."
                  : "Get notified when searches, exports, or data loads finish while you're in another tab."}
              </p>
            </div>
          </label>
        </Section>

        {/* Workflow */}
        <Section title="Workflow">
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={skipReveal}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSkipReveal(on);
                  if (on) localStorage.setItem("nav_skip_reveal_confirm", "1");
                  else localStorage.removeItem("nav_skip_reveal_confirm");
                }}
                className="mt-0.5 h-4 w-4 rounded border-surface-3 bg-surface-2 accent-accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-text-primary">Skip email reveal confirmation</span>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Clicking &ldquo;Find email&rdquo; reveals immediately without a confirmation step.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={autoExport}
                onChange={(e) => {
                  const on = e.target.checked;
                  setAutoExport(on);
                  if (on) localStorage.setItem("nav_auto_export", "1");
                  else localStorage.removeItem("nav_auto_export");
                }}
                className="mt-0.5 h-4 w-4 rounded border-surface-3 bg-surface-2 accent-accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-text-primary">Auto-export (skip contact picker)</span>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  In companies view, Cmd+E exports all contacts directly without opening the picker.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-surface-3 bg-surface-2 accent-accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-text-primary">Show demo data when idle</span>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Display sample companies on the home screen before your first search. Automatically turns off when you search.
                </p>
              </div>
            </label>
          </div>
        </Section>

        {/* Outreach */}
        <Section title="Outreach">
          {!outreachConfigLoaded ? (
            <div className="shimmer h-16 w-full rounded-input" />
          ) : (
            <div className="space-y-4">
              <SettingField label="Freshsales Domain" hint="Your Freshsales subdomain (e.g., mycompany). Used for call deep-links.">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-tertiary">https://</span>
                  <input
                    type="text"
                    value={freshsalesDomain}
                    onChange={(e) => { setFreshsalesDomain(e.target.value); setFreshsalesDomainError(""); }}
                    onBlur={() => {
                      if (freshsalesDomain && !/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i.test(freshsalesDomain)) {
                        setFreshsalesDomainError("Invalid subdomain. Use only letters, numbers, and hyphens.");
                        return;
                      }
                      setFreshsalesDomainError("");
                      saveOutreachConfig(freshsalesDomain, hasLinkedinSalesNav);
                    }}
                    placeholder="mycompany"
                    className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-2.5 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                  <span className="text-xs text-text-tertiary">.freshsales.io</span>
                </div>
                {freshsalesDomainError && <p role="alert" className="mt-1 text-[11px] text-danger">{freshsalesDomainError}</p>}
              </SettingField>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={hasLinkedinSalesNav}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setHasLinkedinSalesNav(on);
                    saveOutreachConfig(freshsalesDomain, on);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-surface-3 bg-surface-2 accent-accent-primary"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">LinkedIn Sales Navigator</span>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    Enable InMail drafting for LinkedIn outreach steps. Without Sales Nav, only connection request notes are available.
                  </p>
                  {hasLinkedinSalesNav && <p className="mt-1 text-[10px] text-warning">Make sure you have an active Sales Navigator subscription. InMail steps will fail silently if you don&apos;t.</p>}
                </div>
              </label>
            </div>
          )}
        </Section>

        {/* Teams Notifications */}
        <Section title="Teams Notifications">
          {!outreachConfigLoaded ? (
            <div className="shimmer h-16 w-full rounded-input" />
          ) : (
            <div className="space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={teamsNotifEnabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setTeamsNotifEnabled(on);
                    saveTeamsConfig(teamsWebhookUrl, on);
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-surface-3 bg-surface-2 accent-accent-primary"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">Enable Teams Notifications</span>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    Receive personal notifications (due steps, export confirmations) via Microsoft Teams.
                  </p>
                </div>
              </label>

              <SettingField label="Personal Webhook URL" hint="Your personal Teams incoming webhook for DM-style notifications.">
                <input
                  type="text"
                  value={teamsWebhookUrl}
                  onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                  onBlur={() => saveTeamsConfig(teamsWebhookUrl, teamsNotifEnabled)}
                  placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
                  className="w-full rounded-input border border-surface-3 bg-surface-2 px-2.5 py-2 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
                />
              </SettingField>

              <div className="flex items-center gap-3">
                <button
                  onClick={sendTeamsTestPersonal}
                  disabled={!teamsWebhookUrl || teamsTestStatus === "sending"}
                  className="rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-50"
                >
                  {teamsTestStatus === "sending" ? "Sending..." : "Send Test Card"}
                </button>
                {teamsTestMessage && (
                  <span className={`text-[11px] ${teamsTestStatus === "success" ? "text-success" : "text-danger"}`}>
                    {teamsTestMessage}
                  </span>
                )}
              </div>

              <details className="rounded-input border border-surface-3 bg-surface-1 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-text-secondary">
                  How to set up Teams Workflow
                </summary>
                <ol className="mt-2 space-y-1.5 text-[11px] text-text-tertiary list-decimal list-inside">
                  <li>Open Microsoft Teams</li>
                  <li>Go to a chat or channel where you want notifications</li>
                  <li>Click &ldquo;...&rdquo; &rarr; &ldquo;Workflows&rdquo; &rarr; &ldquo;Post to a chat when a webhook request is received&rdquo;</li>
                  <li>Follow the prompts to create the workflow</li>
                  <li>Copy the webhook URL and paste it above</li>
                </ol>
              </details>
            </div>
          )}
        </Section>

        {/* Keyboard shortcuts */}
        <Section title="Keyboard Shortcuts">
          <div className="grid grid-cols-3 gap-6">
            {shortcuts.map((group) => (
              <div key={group.group}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{group.group}</p>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <div key={item.keys} className="flex items-center justify-between gap-2 font-mono text-xs">
                      <kbd className="rounded border border-surface-3 bg-surface-2 px-1.5 py-0.5 text-text-secondary">{item.keys}</kbd>
                      <span className="text-text-tertiary">{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Admin quick links */}
        {isAdmin && (
          <Section title="Admin Quick Links">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "ICP Weights", hash: "general" },
                { label: "Pipeline Stages", hash: "pipeline" },
                { label: "API Keys", hash: "api-keys" },
                { label: "Team & Auth", hash: "auth" },
                { label: "Analytics", hash: "analytics" },
                { label: "System", hash: "system" },
              ].map((link) => (
                <a
                  key={link.hash}
                  href={`/admin#${link.hash}`}
                  className="rounded-input border border-surface-3 bg-surface-1 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 border-b border-surface-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        {title}
      </h2>
      {children}
    </div>
  );
}

function SettingField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-primary">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-text-tertiary">{hint}</p>}
    </div>
  );
}
