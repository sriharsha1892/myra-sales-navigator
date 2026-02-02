"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import type { ApiKeyEntry } from "@/lib/types";

const KNOWN_SOURCES = ["exa", "apollo", "hubspot", "clearout"];

interface CreditData {
  clearout: { available: number; total: number } | null;
  apollo: null;
  exa: null;
  hubspot: null;
}

const PROVIDER_DASHBOARDS: Record<string, string> = {
  apollo: "https://app.apollo.io/#/settings/credits",
  exa: "https://dashboard.exa.ai",
  hubspot: "https://app.hubspot.com/usage-reporting",
};

function CreditBadge({ available }: { available: number }) {
  if (available > 10000) {
    return <span className="rounded-badge bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">{available.toLocaleString()} credits</span>;
  }
  if (available >= 1000) {
    return <span className="rounded-badge bg-accent-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">{available.toLocaleString()} credits</span>;
  }
  return (
    <span className="rounded-badge bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium text-danger">
      {available.toLocaleString()} credits — running low
    </span>
  );
}

function CreditUsageBanner() {
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/credits");
      if (res.ok) {
        setCredits(await res.json());
      }
    } catch {
      // silently fail — banner is informational
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return (
    <div className="mb-5 rounded-card border border-surface-3 bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-text-primary">Credit Usage</h3>
        <button
          onClick={fetchCredits}
          disabled={loading}
          className="text-[10px] text-accent-secondary hover:text-accent-secondary/80 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {/* Clearout */}
        <div className="rounded-input border border-surface-3 bg-surface-1 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-text-tertiary">Clearout</p>
          {loading ? (
            <div className="h-4 w-24 animate-pulse rounded bg-surface-3" />
          ) : credits?.clearout ? (
            <CreditBadge available={credits.clearout.available} />
          ) : (
            <span className="text-[10px] text-text-tertiary">Unavailable</span>
          )}
        </div>

        {/* Apollo */}
        <div className="rounded-input border border-surface-3 bg-surface-1 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-text-tertiary">Apollo</p>
          <a href={PROVIDER_DASHBOARDS.apollo} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-secondary hover:underline">
            Check in Apollo dashboard
          </a>
        </div>

        {/* Exa */}
        <div className="rounded-input border border-surface-3 bg-surface-1 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-text-tertiary">Exa</p>
          <a href={PROVIDER_DASHBOARDS.exa} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-secondary hover:underline">
            Check in Exa dashboard
          </a>
        </div>

        {/* HubSpot */}
        <div className="rounded-input border border-surface-3 bg-surface-1 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-text-tertiary">HubSpot</p>
          <a href={PROVIDER_DASHBOARDS.hubspot} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-secondary hover:underline">
            Check in HubSpot dashboard
          </a>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-text-tertiary">
        Credit balances update when you refresh. Clearout uses ~1 credit per email verified.
      </p>
    </div>
  );
}

export function ApiKeysSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const addToast = useStore((s) => s.addToast);
  const userName = useStore((s) => s.userName) ?? "Unknown";

  const [adding, setAdding] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newSource.trim() || !newKey.trim()) return;

    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: newSource.trim(),
          label: newLabel.trim() || newSource.trim(),
          plainKey: newKey.trim(),
          addedBy: userName,
        }),
      });
      const data = await res.json();
      if (data.key) {
        updateConfig({ apiKeys: [...config.apiKeys, data.key] });
        addToast({ message: `API key for ${newSource} added`, type: "success" });
        setAdding(false);
        setNewSource("");
        setNewLabel("");
        setNewKey("");
      } else {
        addToast({ message: data.error || "Failed to add key", type: "error" });
      }
    } catch {
      addToast({ message: "Failed to add API key", type: "error" });
    }
  };

  const handleTest = async (entry: ApiKeyEntry) => {
    setTestingId(entry.id);
    try {
      const res = await fetch("/api/admin/api-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: entry.id, actor: userName }),
      });
      const data = await res.json();
      const updated = config.apiKeys.map((k) =>
        k.id === entry.id
          ? { ...k, testStatus: data.status as ApiKeyEntry["testStatus"], lastTested: new Date().toISOString() }
          : k
      );
      updateConfig({ apiKeys: updated });
      addToast({
        message: `${entry.source} key test: ${data.status}`,
        type: data.status === "success" ? "success" : "error",
      });
    } catch {
      addToast({ message: "Test request failed", type: "error" });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (entry: ApiKeyEntry) => {
    try {
      await fetch("/api/admin/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, actor: userName }),
      });
      updateConfig({ apiKeys: config.apiKeys.filter((k) => k.id !== entry.id) });
      addToast({ message: `API key for ${entry.source} deleted`, type: "success" });
    } catch {
      addToast({ message: "Failed to delete key", type: "error" });
    }
  };

  const handleRotate = async (entry: ApiKeyEntry) => {
    const newPlainKey = prompt("Enter new API key:");
    if (!newPlainKey) return;

    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, plainKey: newPlainKey, actor: userName }),
      });
      const data = await res.json();
      if (data.key) {
        const updated = config.apiKeys.map((k) => (k.id === entry.id ? data.key : k));
        updateConfig({ apiKeys: updated });
        addToast({ message: `API key for ${entry.source} rotated`, type: "success" });
      }
    } catch {
      addToast({ message: "Failed to rotate key", type: "error" });
    }
  };

  const statusColor = (status: ApiKeyEntry["testStatus"]) => {
    switch (status) {
      case "success": return "text-success";
      case "failed": return "text-danger";
      default: return "text-text-tertiary";
    }
  };

  return (
    <AdminSection title="API Key Management">
      <CreditUsageBanner />

      <div className="space-y-2 mb-4">
        {config.apiKeys.length === 0 && !adding && (
          <p className="text-xs italic text-text-tertiary">No API keys configured. Add keys for Exa, Apollo, HubSpot, or Clearout.</p>
        )}
        {config.apiKeys.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-badge bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">
                  {entry.source}
                </span>
                <span className="text-xs text-text-primary">{entry.label}</span>
                <span className={`text-[10px] ${statusColor(entry.testStatus)}`}>
                  {entry.testStatus}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">
                {entry.encryptedKey ? "****" : "—"} &middot; Rotated {new Date(entry.lastRotated).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => handleTest(entry)}
              disabled={testingId === entry.id}
              className="text-[10px] text-accent-primary hover:text-accent-primary/80 disabled:opacity-50"
            >
              {testingId === entry.id ? "Testing..." : "Test"}
            </button>
            <button
              onClick={() => handleRotate(entry)}
              className="text-[10px] text-text-secondary hover:text-text-primary"
            >
              Rotate
            </button>
            <button
              onClick={() => handleDelete(entry)}
              className="text-[10px] text-text-tertiary hover:text-danger"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="space-y-2 rounded-input border border-surface-3 bg-surface-2 p-3">
          <div className="flex gap-2">
            <select
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="">Select source...</option>
              {KNOWN_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
          </div>
          {newSource === "custom" && (
            <input
              type="text"
              value={newSource === "custom" ? "" : newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="Custom source name..."
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
          )}
          <input
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="API key..."
            className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse">
              Save Key
            </button>
            <button
              onClick={() => { setAdding(false); setNewSource(""); setNewLabel(""); setNewKey(""); }}
              className="rounded-input border border-surface-3 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse"
        >
          Add API Key
        </button>
      )}
    </AdminSection>
  );
}
