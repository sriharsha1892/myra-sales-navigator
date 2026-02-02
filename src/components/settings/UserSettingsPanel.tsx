"use client";

import { useStore } from "@/lib/store";
import { useAuth } from "@/providers/AuthProvider";
import { Overlay } from "@/components/primitives/Overlay";
import type { ViewMode, SortField } from "@/lib/types";

interface UserSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function UserSettingsPanel({ open, onClose }: UserSettingsPanelProps) {
  const { userName, logout } = useAuth();
  const config = useStore((s) => s.adminConfig);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const sortField = useStore((s) => s.sortField);
  const setSortField = useStore((s) => s.setSortField);
  const userCopyFormat = useStore((s) => s.userCopyFormat);
  const setUserCopyFormat = useStore((s) => s.setUserCopyFormat);

  return (
    <Overlay open={open} onClose={onClose} backdrop="dim" placement="end" trapFocus={true}>
      <div className="mt-16 mr-5 w-72 rounded-card border border-surface-3 bg-surface-1 p-4 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm text-text-primary">Settings</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            &times;
          </button>
        </div>

        <div className="mb-3">
          <span className="text-xs text-text-tertiary">Logged in as</span>
          <p className="text-sm font-medium text-text-primary">{userName}</p>
        </div>

        <div className="space-y-3 border-t border-surface-3 pt-3">
          <div>
            <label className="mb-1 block text-[10px] text-text-tertiary">Default View</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="companies">Companies</option>
              <option value="contacts">Contacts</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] text-text-tertiary">Default Sort</label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="icp_score">ICP Score</option>
              <option value="name">Name</option>
              <option value="employee_count">Employee Count</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] text-text-tertiary">Copy Format</label>
            <select
              value={userCopyFormat}
              onChange={(e) => setUserCopyFormat(e.target.value)}
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              {config.copyFormats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Keyboard shortcuts reference */}
        <div className="mt-4 border-t border-surface-3 pt-3">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Keyboard Shortcuts
          </h4>
          <div className="space-y-1 font-mono text-[10px]">
            <ShortcutRow keys="Cmd+K" action="Command palette" />
            <ShortcutRow keys="\u2191 \u2193" action="Navigate results" />
            <ShortcutRow keys="Enter" action="Select company" />
            <ShortcutRow keys="Space" action="Toggle checkbox" />
            <ShortcutRow keys="Cmd+A" action="Select all" />
            <ShortcutRow keys="Cmd+E" action="Export" />
            <ShortcutRow keys="/" action="Focus filter search" />
            <ShortcutRow keys="Esc" action="Close / Clear" />
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-4 w-full rounded-input border border-surface-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          Log Out
        </button>
      </div>
    </Overlay>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{keys}</span>
      <span className="text-text-tertiary">{action}</span>
    </div>
  );
}
