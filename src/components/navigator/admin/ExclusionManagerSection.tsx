"use client";

import { useState, useRef, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { Exclusion } from "@/lib/navigator/types";

interface CsvEntry {
  type: Exclusion["type"];
  value: string;
  reason?: string;
}

function parseCSV(text: string, defaultType: Exclusion["type"]): CsvEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: CsvEntry[] = [];

  for (const line of lines) {
    // Skip header-looking lines
    if (/^type[,\t]/i.test(line) && lines.indexOf(line) === 0) continue;

    const parts = line.split(/[,\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""));

    if (parts.length >= 2 && ["company", "domain", "email"].includes(parts[0])) {
      entries.push({
        type: parts[0] as Exclusion["type"],
        value: parts[1],
        reason: parts[2] || undefined,
      });
    } else if (parts.length === 1 || !["company", "domain", "email"].includes(parts[0])) {
      entries.push({ type: defaultType, value: parts[0], reason: undefined });
    }
  }

  return entries.filter((e) => e.value);
}

export function ExclusionManagerSection() {
  const exclusions = useStore((s) => s.exclusions);
  const addToast = useStore((s) => s.addToast);
  const addProgressToast = useStore((s) => s.addProgressToast);
  const addUndoToast = useStore((s) => s.addUndoToast);
  const userName = useStore((s) => s.userName) ?? "Unknown";

  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState<Exclusion["type"]>("company");
  const [newReason, setNewReason] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  // CSV upload state
  const [dragOver, setDragOver] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvEntry[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = exclusions.filter((e) =>
    e.value.toLowerCase().includes(search.toLowerCase()) ||
    e.type.toLowerCase().includes(search.toLowerCase())
  );

  // Counts
  const domainCount = exclusions.filter((e) => e.type === "domain").length;
  const companyCount = exclusions.filter((e) => e.type === "company").length;
  const emailCount = exclusions.filter((e) => e.type === "email").length;

  const handleAdd = async () => {
    if (!newValue.trim() || adding) return;
    setAdding(true);

    try {
      const res = await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          value: newValue.trim(),
          reason: newReason.trim() || undefined,
          addedBy: userName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast({ message: data.error || "Couldn't add exclusion — try again", type: "error" });
        return;
      }

      useStore.setState({ exclusions: [data.exclusion, ...exclusions] });
      addToast({ message: `Exclusion "${newValue.trim()}" added`, type: "success" });
      setNewValue("");
      setNewReason("");
    } catch {
      addToast({ message: "Couldn't add exclusion — check your connection and try again", type: "error" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (exclusion: Exclusion) => {
    // Optimistic: remove immediately
    const snapshot = exclusions;
    useStore.setState({ exclusions: exclusions.filter((e) => e.id !== exclusion.id) });

    let undone = false;

    addUndoToast(`Exclusion "${exclusion.value}" removed`, () => {
      undone = true;
      useStore.setState({ exclusions: snapshot });
    });

    // Wait for undo window, then commit
    setTimeout(async () => {
      if (undone) return;
      try {
        const res = await fetch("/api/exclusions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: exclusion.id }),
        });
        if (!res.ok) {
          // Restore on failure
          useStore.setState({ exclusions: snapshot });
          addToast({ message: "Couldn't remove exclusion — refresh the page and try again", type: "error" });
        }
      } catch {
        useStore.setState({ exclusions: snapshot });
        addToast({ message: "Failed to delete exclusion", type: "error" });
      }
    }, 6500); // slightly after undo deadline
  };

  // CSV handling
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const entries = parseCSV(text, newType);
      if (entries.length === 0) {
        addToast({ message: "No valid entries found in file", type: "warning" });
        return;
      }
      setCsvPreview(entries);
    };
    reader.readAsText(file);
  }, [newType, addToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // reset so same file can be re-selected
  }, [handleFile]);

  const handleImport = async () => {
    if (!csvPreview || importing) return;
    setImporting(true);

    const progress = addProgressToast(`Importing ${csvPreview.length} exclusions...`);

    try {
      const res = await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: csvPreview,
          addedBy: userName,
          source: "csv_upload",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        progress.reject(data.error || "Import failed");
        return;
      }

      progress.resolve(`${data.inserted} exclusions imported`);
      setCsvPreview(null);

      // Refresh exclusions from server
      try {
        const listRes = await fetch("/api/exclusions");
        const listData = await listRes.json();
        if (listRes.ok && listData.exclusions) {
          useStore.setState({ exclusions: listData.exclusions });
        }
      } catch {
        // non-critical — list will be stale until page reload
      }
    } catch {
      progress.reject("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const csvDomainCount = csvPreview?.filter((e) => e.type === "domain").length ?? 0;
  const csvCompanyCount = csvPreview?.filter((e) => e.type === "company").length ?? 0;
  const csvEmailCount = csvPreview?.filter((e) => e.type === "email").length ?? 0;

  return (
    <AdminSection title="Exclusion List Manager">
      {/* Count summary */}
      <p className="mb-3 text-[10px] text-text-tertiary">
        {exclusions.length} exclusions
        {exclusions.length > 0 && (
          <span> &middot; {domainCount} domains &middot; {companyCount} companies &middot; {emailCount} emails</span>
        )}
      </p>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exclusions..."
        className="mb-3 w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
      />

      {/* Exclusion list */}
      <div className="mb-3 max-h-48 space-y-1 overflow-y-auto">
        {filtered.map((e) => (
          <div key={e.id} className="group flex items-center gap-3 rounded px-2 py-1.5 text-xs hover:bg-surface-hover">
            <span className="rounded-badge bg-surface-3 px-1.5 py-0.5 text-[10px] capitalize text-text-secondary">
              {e.type}
            </span>
            <span className="flex-1 text-text-primary">{e.value}</span>
            {e.reason && (
              <span className="text-[10px] text-text-tertiary" title={e.reason}>
                {e.reason.length > 20 ? e.reason.slice(0, 20) + "..." : e.reason}
              </span>
            )}
            <span className="text-[10px] text-text-tertiary">by {e.addedBy}</span>
            <button
              onClick={() => handleDelete(e)}
              className="text-[10px] text-text-tertiary opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              aria-label="Remove exclusion"
            >
              &times;
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-2 text-center text-xs italic text-text-tertiary">No exclusions found</p>
        )}
      </div>

      {/* Manual add row */}
      <div className="mb-4 flex gap-2">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as Exclusion["type"])}
          className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
        >
          <option value="company">Company</option>
          <option value="domain">Domain</option>
          <option value="email">Email</option>
        </select>
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Value to exclude..."
          className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <input
          type="text"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Reason (optional)"
          className="w-36 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newValue.trim()}
          className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </div>

      {/* CSV Upload */}
      {csvPreview ? (
        <div className="rounded-input border border-surface-3 bg-surface-2 p-3">
          <p className="mb-2 text-xs text-text-primary">
            Found {csvPreview.length} entries
            {(csvDomainCount > 0 || csvCompanyCount > 0 || csvEmailCount > 0) && (
              <span className="text-text-tertiary">
                {" "}({csvDomainCount} domains, {csvCompanyCount} companies, {csvEmailCount} emails)
              </span>
            )}
          </p>
          <div className="mb-3 max-h-32 overflow-y-auto rounded border border-surface-3 bg-surface-1 p-2">
            {csvPreview.slice(0, 10).map((entry, i) => (
              <div key={i} className="flex gap-2 py-0.5 text-[10px]">
                <span className="rounded-badge bg-surface-3 px-1 py-0.5 capitalize text-text-secondary">{entry.type}</span>
                <span className="text-text-primary">{entry.value}</span>
                {entry.reason && <span className="text-text-tertiary">{entry.reason}</span>}
              </div>
            ))}
            {csvPreview.length > 10 && (
              <p className="mt-1 text-[10px] text-text-tertiary">...and {csvPreview.length - 10} more</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import"}
            </button>
            <button
              onClick={() => setCsvPreview(null)}
              disabled={importing}
              className="rounded-input border border-surface-3 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-input border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragOver
              ? "border-accent-primary bg-accent-primary/5"
              : "border-surface-3 hover:border-surface-3/80 hover:bg-surface-hover"
          }`}
        >
          <p className="text-xs text-text-secondary">
            Drop a CSV file here, or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      <p className="mt-2 text-[10px] text-text-tertiary">
        CSV format: one entry per line. Columns: type (company/domain/email), value, reason (optional).
        If only values are provided, the selected type above will be used.
        Example: <span className="font-mono">domain,competitor.com,Direct competitor</span>
      </p>
    </AdminSection>
  );
}
