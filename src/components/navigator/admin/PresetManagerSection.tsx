"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import { pick } from "@/lib/navigator/ui-copy";

export function PresetManagerSection() {
  const presets = useStore((s) => s.presets);
  const deletePreset = useStore((s) => s.deletePreset);
  const clearPresetNotification = useStore((s) => s.clearPresetNotification);

  return (
    <AdminSection title="Search Preset Manager">
      <div className="space-y-2">
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-primary">{p.name}</span>
                {(p.newResultCount ?? 0) > 0 && (
                  <span className="rounded-pill bg-accent-primary/15 px-1.5 py-px text-[10px] font-semibold text-accent-primary">
                    {p.newResultCount} new
                  </span>
                )}
              </div>
              <p className="text-[10px] text-text-tertiary">
                by {p.createdBy} &middot; {new Date(p.createdAt).toLocaleDateString()}
                {p.lastCheckedAt && (
                  <> &middot; checked {new Date(p.lastCheckedAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
            {(p.newResultCount ?? 0) > 0 && (
              <button
                onClick={() => clearPresetNotification(p.id)}
                className="text-[10px] text-text-tertiary hover:text-text-primary"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => deletePreset(p.id)}
              className="text-xs text-text-tertiary hover:text-danger"
            >
              Delete
            </button>
          </div>
        ))}
        {presets.length === 0 && (
          <p className="text-xs italic text-text-tertiary">{pick("empty_presets")}</p>
        )}
      </div>
    </AdminSection>
  );
}
