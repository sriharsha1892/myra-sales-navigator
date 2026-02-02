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
            <p className="mt-0.5 text-[10px] text-text-tertiary">Show companies or individual contacts first when you search.</p>
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
            <p className="mt-0.5 text-[10px] text-text-tertiary">How results are ordered. ICP Score puts best-fit companies first.</p>
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
            <p className="mt-0.5 text-[10px] text-text-tertiary">What gets copied when you click the copy button on a contact.</p>
            <div className="mt-1 rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5">
              <p className="text-[10px] text-text-tertiary">Preview:</p>
              <p className="whitespace-pre-wrap font-mono text-[10px] text-text-secondary">
                {(() => {
                  const fmt = config.copyFormats.find((f) => f.id === userCopyFormat);
                  if (!fmt) return "Sarah Chen <schen@ingredion.com>";
                  return fmt.template
                    .replace("{name}", "Sarah Chen")
                    .replace("{email}", "schen@ingredion.com")
                    .replace("{title}", "VP of Procurement")
                    .replace("{company}", "Ingredion")
                    .replace("{phone}", "+1 555-0100");
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts reference — grouped by context */}
        <div className="mt-4 border-t border-surface-3 pt-3">
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Keyboard Shortcuts
          </h4>
          <div className="space-y-2.5 font-mono text-[10px]">
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">Anywhere</p>
              <div className="space-y-0.5">
                <ShortcutRow keys="Cmd+K" action="Search" />
                <ShortcutRow keys="Esc" action="Close" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">In results list</p>
              <div className="space-y-0.5">
                <ShortcutRow keys={"\u2191 \u2193"} action="Move between companies" />
                <ShortcutRow keys="Space" action="Select / deselect" />
                <ShortcutRow keys="Enter" action="Open details" />
                <ShortcutRow keys="/" action="Focus filter search" />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">With selection</p>
              <div className="space-y-0.5">
                <ShortcutRow keys="Cmd+A" action="Select all" />
                <ShortcutRow keys="Cmd+E" action="Export" />
                <ShortcutRow keys="Cmd+C" action="Copy email" />
              </div>
            </div>
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
