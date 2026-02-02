"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";

export function ExclusionManagerSection() {
  const exclusions = useStore((s) => s.exclusions);
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState<"company" | "domain" | "email">("company");
  const [search, setSearch] = useState("");
  const addToast = useStore((s) => s.addToast);

  const filtered = exclusions.filter((e) =>
    e.value.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!newValue.trim()) return;
    addToast({ message: `Exclusion "${newValue.trim()}" added (mock)`, type: "success" });
    setNewValue("");
  };

  return (
    <AdminSection title="Exclusion List Manager">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exclusions..."
        className="mb-3 w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
      />
      <div className="mb-3 max-h-48 space-y-1 overflow-y-auto">
        {filtered.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded px-2 py-1.5 text-xs hover:bg-surface-hover">
            <span className="rounded-badge bg-surface-3 px-1.5 py-0.5 text-[10px] capitalize text-text-secondary">
              {e.type}
            </span>
            <span className="flex-1 text-text-primary">{e.value}</span>
            <span className="text-[10px] text-text-tertiary">by {e.addedBy}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-2 text-center text-xs italic text-text-tertiary">No exclusions found</p>
        )}
      </div>
      <div className="flex gap-2">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as typeof newType)}
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
        <button onClick={handleAdd} className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse">
          Add
        </button>
      </div>
    </AdminSection>
  );
}
