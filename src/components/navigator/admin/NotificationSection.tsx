"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { NotificationSettings } from "@/lib/navigator/types";

type TeamsExtended = NotificationSettings & {
  teamsEnabled?: boolean;
  teamChannelWebhookUrl?: string;
  enabledNotifications?: string[];
};

const TEAMS_NOTIFICATION_TYPES = [
  { id: "due_steps", label: "Due Steps (personal DMs)" },
  { id: "export_summaries", label: "Export Summaries (channel)" },
  { id: "weekly_digest", label: "Weekly Digest (channel)" },
  { id: "announcements", label: "Announcements (channel)" },
] as const;

export function NotificationSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.notifications;
  const teamsConfig = settings as TeamsExtended;

  const [newRecipient, setNewRecipient] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [teamsTestStatus, setTeamsTestStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [teamsTestMessage, setTeamsTestMessage] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementSendToAll, setAnnouncementSendToAll] = useState(false);
  const [announcementStatus, setAnnouncementStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const update = (partial: Partial<NotificationSettings>) => {
    updateConfig({ notifications: { ...settings, ...partial } });
  };

  const toggleNotificationType = (typeId: string) => {
    const current = teamsConfig.enabledNotifications ?? [];
    const next = current.includes(typeId)
      ? current.filter((t) => t !== typeId)
      : [...current, typeId];
    update({ ...settings, enabledNotifications: next } as NotificationSettings);
  };

  const sendTeamsTest = async () => {
    if (!teamsConfig.teamChannelWebhookUrl) return;
    setTeamsTestStatus("sending");
    setTeamsTestMessage("");
    try {
      const res = await fetch("/api/teams/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: teamsConfig.teamChannelWebhookUrl, type: "channel" }),
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

  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    setAnnouncementStatus("sending");
    try {
      const res = await fetch("/api/teams/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "announcement",
          payload: {
            title: announcementTitle.trim(),
            body: announcementBody.trim(),
            author: "Admin",
            sendToAll: announcementSendToAll,
          },
        }),
      });
      if (res.ok) {
        setAnnouncementStatus("success");
        setAnnouncementTitle("");
        setAnnouncementBody("");
        setAnnouncementSendToAll(false);
        setTimeout(() => setAnnouncementStatus("idle"), 3000);
      } else {
        setAnnouncementStatus("error");
      }
    } catch {
      setAnnouncementStatus("error");
    }
  };

  const addRecipient = () => {
    const val = newRecipient.trim();
    if (!val) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setRecipientError("Please enter a valid email address.");
      return;
    }
    if (settings.digestRecipients.includes(val)) {
      setNewRecipient("");
      setRecipientError("");
      return;
    }
    update({ digestRecipients: [...settings.digestRecipients, val] });
    setNewRecipient("");
    setRecipientError("");
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
              onChange={(e) => { setNewRecipient(e.target.value); if (recipientError) setRecipientError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") addRecipient(); }}
              placeholder="Add email or name..."
              className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
            <button
              onClick={addRecipient}
              disabled={!newRecipient.trim()}
              className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {recipientError && (
            <p className="mt-1 text-[10px] text-danger">{recipientError}</p>
          )}
          <p className="mt-1.5 text-[10px] text-text-tertiary">
            Daily digest includes: total searches, exports, new exclusions, and credit usage from the past 24 hours.
          </p>
        </div>

        {/* Teams Notifications */}
        <div className="rounded-card border border-surface-3 bg-surface-1 p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={teamsConfig.teamsEnabled ?? false}
              onChange={(e) => update({ ...settings, teamsEnabled: e.target.checked } as NotificationSettings)}
              className="h-3.5 w-3.5 rounded accent-accent-primary"
            />
            <span className="text-xs font-medium text-text-primary">Enable Teams Notifications</span>
          </label>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">Team Channel Webhook URL</label>
            <input
              type="text"
              value={teamsConfig.teamChannelWebhookUrl ?? ""}
              onChange={(e) => update({ ...settings, teamChannelWebhookUrl: e.target.value || undefined } as NotificationSettings)}
              placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">Notification Types</label>
            <div className="space-y-2">
              {TEAMS_NOTIFICATION_TYPES.map((nt) => (
                <label key={nt.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(teamsConfig.enabledNotifications ?? []).includes(nt.id)}
                    onChange={() => toggleNotificationType(nt.id)}
                    className="h-3.5 w-3.5 rounded accent-accent-primary"
                  />
                  <span className="text-xs text-text-primary">{nt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={sendTeamsTest}
              disabled={!teamsConfig.teamChannelWebhookUrl || teamsTestStatus === "sending"}
              className="rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {teamsTestStatus === "sending" ? "Sending..." : "Send Test Card"}
            </button>
            {teamsTestMessage && (
              <span role="alert" className={`text-[10px] ${teamsTestStatus === "success" ? "text-success" : "text-danger"}`}>
                {teamsTestMessage}
              </span>
            )}
          </div>

          {/* Announcement Composer */}
          {teamsConfig.teamsEnabled && (
            <div className="border-t border-surface-3 pt-4 space-y-3">
              <label className="block text-[10px] font-medium uppercase text-text-tertiary">Send Announcement</label>
              <input
                type="text"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Announcement title"
                className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
              />
              <textarea
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
                placeholder="Announcement body"
                rows={3}
                className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none resize-none"
              />
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={announcementSendToAll}
                  onChange={(e) => setAnnouncementSendToAll(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-accent-primary"
                />
                <span className="text-xs text-text-primary">Send to all users too</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={sendAnnouncement}
                  disabled={!announcementTitle.trim() || !announcementBody.trim() || announcementStatus === "sending"}
                  className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {announcementStatus === "sending" ? "Sending..." : "Send Now"}
                </button>
                {announcementStatus === "success" && (
                  <span className="text-[10px] text-success">Announcement sent.</span>
                )}
                {announcementStatus === "error" && (
                  <span className="text-[10px] text-danger">Failed to send announcement.</span>
                )}
              </div>
            </div>
          )}
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
