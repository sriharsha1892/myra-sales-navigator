"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import { pick } from "@/lib/navigator/ui-copy";

export function PresetManagerSection() {
  const presets = useStore((s) => s.presets);
  const deletePreset = useStore((s) => s.deletePreset);
  const updatePreset = useStore((s) => s.updatePreset);
  const clearPresetNotification = useStore((s) => s.clearPresetNotification);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updatePreset(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  return (
    <AdminSection title="Search Preset Manager">
      <div className="space-y-2">
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
            <div className="flex-1">
              {editingId === p.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                    className="flex-1 rounded-input border border-accent-primary bg-surface-1 px-2 py-1 text-xs text-text-primary focus:outline-none"
                  />
                  <button
                    onClick={saveEdit}
                    disabled={!editName.trim()}
                    className="text-[10px] text-accent-primary hover:text-accent-primary-hover disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-[10px] text-text-tertiary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
            {editingId !== p.id && (
              <>
                {(p.newResultCount ?? 0) > 0 && (
                  <button
                    onClick={() => clearPresetNotification(p.id)}
                    className="text-[10px] text-text-tertiary hover:text-text-primary"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => startEdit(p.id, p.name)}
                  className="text-xs text-text-tertiary hover:text-text-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePreset(p.id)}
                  className="text-xs text-text-tertiary hover:text-danger"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
        {presets.length === 0 && (
          <p className="text-xs italic text-text-tertiary">{pick("empty_presets")}</p>
        )}
      </div>
    </AdminSection>
  );
}
