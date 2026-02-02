"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";

export function VerticalConfigSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const [newVertical, setNewVertical] = useState("");

  const addVertical = () => {
    if (!newVertical.trim()) return;
    if (config.verticals.includes(newVertical.trim())) return;
    updateConfig({ verticals: [...config.verticals, newVertical.trim()] });
    setNewVertical("");
  };

  const removeVertical = (v: string) => {
    updateConfig({ verticals: config.verticals.filter((x) => x !== v) });
  };

  return (
    <AdminSection title="Vertical Configuration">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {config.verticals.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-surface-3 bg-surface-2 px-2.5 py-1 text-xs text-text-primary"
          >
            {v}
            <button onClick={() => removeVertical(v)} className="text-text-tertiary hover:text-danger">
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newVertical}
          onChange={(e) => setNewVertical(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addVertical(); }}
          placeholder="Add vertical..."
          className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <button onClick={addVertical} className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse">
          Add
        </button>
      </div>
    </AdminSection>
  );
}
