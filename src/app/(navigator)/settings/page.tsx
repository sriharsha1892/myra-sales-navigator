"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { useStore } from "@/lib/navigator/store";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";
import type { ViewMode, SortField } from "@/lib/navigator/types";

const SHORTCUTS = [
  { group: "Anywhere", items: [{ keys: "\u2318K", action: "Smart search" }, { keys: "Esc", action: "Close" }] },
  { group: "Results", items: [{ keys: "\u2191 \u2193", action: "Navigate" }, { keys: "Space", action: "Select / deselect" }, { keys: "Enter", action: "Open details" }, { keys: "/", action: "Focus filter" }] },
  { group: "Selection", items: [{ keys: "\u2318A", action: "Select all" }, { keys: "\u2318E", action: "Export" }, { keys: "\u2318C", action: "Copy email" }] },
];

export default function SettingsPage() {
  const { userName, isAdmin, isLoading } = useAuth();
  const config = useStore((s) => s.adminConfig);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const sortField = useStore((s) => s.sortField);
  const setSortField = useStore((s) => s.setSortField);
  const userCopyFormat = useStore((s) => s.userCopyFormat);
  const setUserCopyFormat = useStore((s) => s.setUserCopyFormat);
  const { enabled: notificationsEnabled, permission: notifPermission, toggleEnabled } = useBrowserNotifications();

  // Workflow preference: skip reveal confirm
  const [skipReveal, setSkipReveal] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("nav_skip_reveal_confirm") === "1" : false
  );
  const [autoExport, setAutoExport] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("nav_auto_export") === "1" : false
  );

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
                <option value="contacts">Contacts</option>
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
          </div>
        </Section>

        {/* Keyboard shortcuts */}
        <Section title="Keyboard Shortcuts">
          <div className="grid grid-cols-3 gap-6">
            {SHORTCUTS.map((group) => (
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
