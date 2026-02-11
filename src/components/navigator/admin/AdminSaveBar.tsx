"use client";

import { cn } from "@/lib/cn";

interface AdminSaveBarProps {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saving?: boolean;
}

export function AdminSaveBar({ isDirty, onSave, onDiscard, saving }: AdminSaveBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-surface-3 bg-surface-1 px-6 py-3 shadow-lg transition-transform duration-[180ms] ease-out",
        isDirty ? "translate-y-0" : "translate-y-full"
      )}
    >
      <span className="text-sm text-text-secondary">You have unsaved changes</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onDiscard}
          disabled={saving}
          className="rounded-input border border-surface-3 px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-input bg-accent-primary px-4 py-1.5 text-xs font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
