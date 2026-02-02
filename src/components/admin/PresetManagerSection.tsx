"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";

export function PresetManagerSection() {
  const presets = useStore((s) => s.presets);
  const deletePreset = useStore((s) => s.deletePreset);

  return (
    <AdminSection title="Search Preset Manager">
      <div className="space-y-2">
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
            <div className="flex-1">
              <span className="text-xs font-medium text-text-primary">{p.name}</span>
              <p className="text-[10px] text-text-tertiary">
                by {p.createdBy} &middot; {new Date(p.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => deletePreset(p.id)}
              className="text-xs text-text-tertiary hover:text-danger"
            >
              Delete
            </button>
          </div>
        ))}
        {presets.length === 0 && (
          <p className="text-xs italic text-text-tertiary">No presets saved yet</p>
        )}
      </div>
    </AdminSection>
  );
}
