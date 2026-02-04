"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { TeamMember, AuthAccessRequest } from "@/lib/navigator/types";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
}

export function TeamMembersSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const addToast = useStore((s) => s.addToast);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<AuthAccessRequest[]>([]);

  useEffect(() => {
    setPendingRequests(config.authRequests ?? []);
  }, [config.authRequests]);

  const addMember = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    if (config.teamMembers.some((m) => m.name === newName.trim())) return;

    const newMember: TeamMember = {
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      isAdmin: false,
    };

    updateConfig({
      teamMembers: [...config.teamMembers, newMember],
    });

    // Auto-generate login link for new member
    try {
      const res = await fetch("/api/admin/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMember.email }),
      });
      if (res.ok) {
        const { url } = await res.json();
        await navigator.clipboard.writeText(url);
        addToast({ message: `Added ${newMember.name} — login link copied`, type: "success" });
      }
    } catch {
      addToast({ message: `Added ${newMember.name} (link generation failed)`, type: "warning" });
    }

    setNewName("");
    setNewEmail("");
  };

  const addUndoToast = useStore((s) => s.addUndoToast);

  const removeMember = (name: string) => {
    const member = config.teamMembers.find((m) => m.name === name);
    if (!member) return;
    const snapshot = [...config.teamMembers];
    updateConfig({ teamMembers: config.teamMembers.filter((m) => m.name !== name) });
    addUndoToast(`Removed ${name}`, () => {
      updateConfig({ teamMembers: snapshot });
    });
  };

  const toggleAdmin = (name: string) => {
    updateConfig({
      teamMembers: config.teamMembers.map((m): TeamMember =>
        m.name === name ? { ...m, isAdmin: !m.isAdmin } : m
      ),
    });
  };

  const generateLink = async (member: TeamMember) => {
    setGenerating(member.email);
    try {
      const res = await fetch("/api/admin/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email }),
      });
      if (!res.ok) return;
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setCopiedEmail(member.email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } finally {
      setGenerating(null);
    }
  };

  const generateAllLinks = async () => {
    setBulkGenerating(true);
    try {
      const emails = config.teamMembers.map((m) => m.email);
      const res = await fetch("/api/admin/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      if (!res.ok) {
        addToast({ message: "Failed to generate links", type: "error" });
        return;
      }
      const { links } = await res.json();

      // Format clipboard block
      const expiresIn = links[0]?.expiresIn ?? "60 minutes";
      const block = [
        `myRA Login Links (expire in ${expiresIn})`,
        "",
        ...links.map((l: { name: string; url: string }) => `${l.name}: ${l.url}`),
      ].join("\n");

      await navigator.clipboard.writeText(block);
      addToast({ message: `${links.length} login links copied to clipboard`, type: "success" });
    } catch {
      addToast({ message: "Failed to generate links", type: "error" });
    } finally {
      setBulkGenerating(false);
    }
  };

  const sendViaTeams = async (member: TeamMember) => {
    const webhookUrl = config.authSettings?.teamsWebhookUrl;
    if (!webhookUrl) {
      addToast({ message: "Teams webhook not configured", type: "warning" });
      return;
    }

    setGenerating(member.email);
    try {
      const res = await fetch("/api/admin/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email }),
      });
      if (!res.ok) return;
      const { url, expiresIn } = await res.json();

      // Send adaptive card to Teams
      const card = {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                { type: "TextBlock", text: "myRA Sales Navigator", weight: "bolder", size: "medium" },
                { type: "TextBlock", text: `Hi ${member.name}, here's your login link:`, wrap: true },
                { type: "TextBlock", text: `Expires in ${expiresIn}`, size: "small", isSubtle: true },
              ],
              actions: [
                { type: "Action.OpenUrl", title: "Log In to myRA", url },
              ],
            },
          },
        ],
      };

      const teamsRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });

      if (teamsRes.ok) {
        addToast({ message: `Login link sent to ${member.name} via Teams`, type: "success" });
      } else {
        addToast({ message: "Teams webhook failed", type: "error" });
      }
    } finally {
      setGenerating(null);
    }
  };

  const dismissRequest = (email: string) => {
    const updated = pendingRequests.filter((r) => r.email !== email);
    setPendingRequests(updated);
    updateConfig({ authRequests: updated });
  };

  const handleRequestSendLink = async (req: AuthAccessRequest) => {
    const member = config.teamMembers.find(
      (m) => m.email.toLowerCase() === req.email.toLowerCase()
    );
    if (member) {
      await generateLink(member);
      dismissRequest(req.email);
    }
  };

  return (
    <AdminSection title="Team Members">
      {/* Pending access requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-4 rounded-input border border-accent-primary/30 bg-accent-primary/5 p-3">
          <p className="mb-2 text-[10px] font-medium uppercase text-accent-primary">
            Pending Access Requests ({pendingRequests.length})
          </p>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.email} className="flex items-center gap-3">
                <span className="flex-1 text-xs text-text-primary">
                  {req.name} <span className="text-text-tertiary">{req.email}</span>
                  <span className="ml-2 text-[10px] text-text-tertiary">{relativeTime(req.requestedAt)}</span>
                </span>
                <button
                  onClick={() => handleRequestSendLink(req)}
                  className="rounded-input bg-accent-primary px-2 py-0.5 text-[10px] font-medium text-text-inverse"
                >
                  Send link
                </button>
                <button
                  onClick={() => dismissRequest(req.email)}
                  className="text-[10px] text-text-tertiary hover:text-danger"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase text-text-tertiary">
          {config.teamMembers.length} members
        </p>
        <button
          onClick={generateAllLinks}
          disabled={bulkGenerating}
          className="rounded-input border border-surface-3 bg-surface-1 px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary disabled:opacity-50"
        >
          {bulkGenerating ? "Generating..." : "Generate all links"}
        </button>
      </div>

      <div className="space-y-2 mb-3">
        {config.teamMembers.map((m) => (
          <div key={m.name} className="flex items-center gap-3 rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
            <span className="flex-1 text-xs text-text-primary">
              {m.name} <span className="text-text-tertiary">{m.email}</span>
            </span>
            {/* Last login */}
            <span className="text-[10px] text-text-tertiary">
              {m.lastLoginAt ? (
                relativeTime(m.lastLoginAt)
              ) : (
                <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-amber-400">Never</span>
              )}
            </span>
            <button
              onClick={() => generateLink(m)}
              disabled={generating === m.email}
              className="rounded-input border border-surface-3 bg-surface-1 px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary disabled:opacity-50"
            >
              {copiedEmail === m.email ? "Copied!" : generating === m.email ? "..." : "Login link"}
            </button>
            {config.authSettings?.teamsWebhookUrl && (
              <button
                onClick={() => sendViaTeams(m)}
                disabled={generating === m.email}
                className="rounded-input border border-surface-3 bg-surface-1 px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-accent-secondary hover:text-accent-secondary disabled:opacity-50"
              >
                Teams
              </button>
            )}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={m.isAdmin}
                onChange={() => toggleAdmin(m.name)}
                className="h-3 w-3 rounded accent-accent-primary"
              />
              <span className="text-[10px] text-text-secondary">Admin</span>
            </label>
            <button
              onClick={() => removeMember(m.name)}
              className="text-xs text-text-tertiary hover:text-danger"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addMember(); }}
          placeholder="Email"
          className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <button onClick={addMember} className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse">
          Add
        </button>
      </div>
    </AdminSection>
  );
}
