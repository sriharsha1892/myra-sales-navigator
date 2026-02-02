"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/command/CommandPalette";
import { BulkActionBar } from "@/components/shared";
import { UserSettingsPanel } from "@/components/settings/UserSettingsPanel";
import { SearchBridge } from "@/components/SearchBridge";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuth } from "@/providers/AuthProvider";
import { useStore } from "@/lib/store";
import { MentionNotifications } from "@/components/MentionNotifications";

export default function Home() {
  const { userName, isAdmin, isLoading } = useAuth();
  const isCommandPaletteOpen = useStore((s) => s.commandPaletteOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useKeyboardShortcuts();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0">
        <div className="text-center">
          <div className="shimmer mx-auto h-8 w-32 rounded-card" />
          <p className="mt-3 text-sm text-text-tertiary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-surface-0">
      {/* Top bar */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-surface-3 bg-surface-1 px-5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg text-text-primary">myRA</h1>
          <span className="text-xs text-text-tertiary">Sales Navigator</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => useStore.getState().setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-pill border border-surface-3 bg-surface-2 px-4 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search companies...</span>
            <kbd className="ml-2 rounded border border-surface-3 bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
              &#8984;K
            </kbd>
          </button>
          <MentionNotifications />
          {isAdmin && (
            <a
              href="/admin"
              className="text-sm text-text-secondary hover:text-accent-primary"
            >
              Admin
            </a>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary text-xs font-semibold text-text-inverse"
            title={userName ?? "Settings"}
          >
            {userName?.[0]?.toUpperCase() ?? "?"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="h-[calc(100vh-56px)]">
        <AppShell />
      </div>

      {/* Overlays */}
      {isCommandPaletteOpen && <CommandPalette />}
      <UserSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BulkActionBar />
      <SearchBridge />
    </div>
  );
}
