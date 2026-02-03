"use client";

import { useAuth } from "@/providers/AuthProvider";
import { Overlay } from "@/components/primitives/Overlay";

interface UserSettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function UserSettingsPanel({ open, onClose }: UserSettingsPanelProps) {
  const { userName, isAdmin, logout } = useAuth();

  return (
    <Overlay open={open} onClose={onClose} backdrop="transparent" placement="end" trapFocus={true} lockScroll={false}>
      <div
        className="fixed right-4 top-14 w-52 rounded-card border border-surface-3 bg-surface-1 shadow-lg"
        style={{ animation: "fadeInUp 120ms var(--ease-spring) both" }}
      >
        {/* User identity */}
        <div className="flex items-center gap-2.5 border-b border-surface-3 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-intel text-[11px] font-semibold text-text-inverse">
            {userName?.[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{userName}</p>
            <p className="text-[10px] text-text-tertiary">{isAdmin ? "Admin" : "Account Manager"}</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="py-1.5">
          <MenuItem href="/settings" label="My Preferences" />
          {isAdmin && <MenuItem href="/admin" label="Admin Settings" />}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-3 px-2 py-1.5">
          <button
            onClick={logout}
            className="w-full rounded-input px-2 py-1.5 text-left text-xs text-text-tertiary transition-colors hover:bg-danger-light hover:text-danger"
          >
            Log Out
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function MenuItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
    >
      {label}
    </a>
  );
}
