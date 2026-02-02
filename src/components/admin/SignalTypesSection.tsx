"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";

export function SignalTypesSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const [newSignal, setNewSignal] = useState("");

  const toggleSignal = (type: string) => {
    const updated = config.signalTypes.map((s) =>
      s.type === type ? { ...s, enabled: !s.enabled } : s
    );
    updateConfig({ signalTypes: updated });
  };

  const addSignal = () => {
    if (!newSignal.trim()) return;
    if (config.signalTypes.some((s) => s.type === newSignal.trim().toLowerCase())) return;
    updateConfig({
      signalTypes: [...config.signalTypes, { type: newSignal.trim().toLowerCase(), enabled: true }],
    });
    setNewSignal("");
  };

  return (
    <AdminSection title="Signal Types">
      <div className="space-y-2 mb-3">
        {config.signalTypes.map((s) => (
          <label key={s.type} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={() => toggleSignal(s.type)}
              className="h-3.5 w-3.5 rounded accent-accent-primary"
            />
            <span className="text-xs capitalize text-text-primary">{s.type}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newSignal}
          onChange={(e) => setNewSignal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addSignal(); }}
          placeholder="Add signal type..."
          className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <button onClick={addSignal} className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse">
          Add
        </button>
      </div>
    </AdminSection>
  );
}
