"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";

export function SizeSweetSpotSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);

  return (
    <AdminSection title="Size Sweet Spot">
      <div className="flex items-center gap-4">
        <div>
          <label className="mb-1 block text-[10px] text-text-tertiary">Min Employees</label>
          <input
            type="number"
            value={config.sizeSweetSpot.min}
            onChange={(e) =>
              updateConfig({ sizeSweetSpot: { ...config.sizeSweetSpot, min: parseInt(e.target.value) || 0 } })
            }
            className="w-28 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        <span className="mt-4 text-text-tertiary">&mdash;</span>
        <div>
          <label className="mb-1 block text-[10px] text-text-tertiary">Max Employees</label>
          <input
            type="number"
            value={config.sizeSweetSpot.max}
            onChange={(e) =>
              updateConfig({ sizeSweetSpot: { ...config.sizeSweetSpot, max: parseInt(e.target.value) || 0 } })
            }
            className="w-28 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent-primary/30"
          style={{
            marginLeft: `${Math.min((config.sizeSweetSpot.min / 100000) * 100, 100)}%`,
            width: `${Math.min(((config.sizeSweetSpot.max - config.sizeSweetSpot.min) / 100000) * 100, 100)}%`,
          }}
        />
      </div>
    </AdminSection>
  );
}
