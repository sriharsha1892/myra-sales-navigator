"use client";

import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/command/CommandPalette";
import { BulkActionBar } from "@/components/shared";
import { UserSettingsPanel } from "@/components/settings/UserSettingsPanel";
import { SearchBridge } from "@/components/SearchBridge";
import { HydrationBridge } from "@/components/HydrationBridge";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAuth } from "@/providers/AuthProvider";
import { useStore } from "@/lib/store";
import { MentionNotifications } from "@/components/MentionNotifications";
import { CreditUsageIndicator } from "@/components/CreditUsageIndicator";

export default function Home() {
  const { userName, isAdmin, isLoading } = useAuth();
  const isCommandPaletteOpen = useStore((s) => s.commandPaletteOpen);
  const searchLoading = useStore((s) => s.searchLoading);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    <div className="relative h-screen overflow-hidden bg-gradient-to-br from-surface-0 via-surface-0 to-surface-2">
      {/* Top bar */}
      <div className="glass-topbar flex h-14 flex-shrink-0 items-center justify-between shadow-sm px-5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg text-accent-primary">myRA</h1>
          <span className="text-xs text-text-tertiary">Sales Navigator</span>
        </div>

        {/* Centered search bar */}
        <div className="relative flex w-full max-w-2xl items-center mx-4">
          {searchLoading ? (
            <svg className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-text-tertiary animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchInput.trim()) {
                useStore.getState().setPendingFreeTextSearch(searchInput.trim());
                setSearchInput("");
              }
              if (e.key === "k" && e.metaKey) {
                e.preventDefault();
                useStore.getState().setCommandPaletteOpen(true);
              }
            }}
            placeholder='Search companies, e.g. "chemicals in Europe"...'
            className="w-full rounded-pill border border-surface-3 bg-surface-2 py-2 pl-9 pr-16 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-[180ms] focus:border-accent-primary focus:shadow-[0_0_0_3px_var(--color-accent-primary-light)] focus:outline-none"
          />
          <kbd
            onClick={() => useStore.getState().setCommandPaletteOpen(true)}
            className="absolute right-3 cursor-pointer rounded border border-surface-3 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary hover:text-text-secondary"
          >
            &#8984;K
          </kbd>
        </div>

        <div className="flex items-center gap-3">
          <CreditUsageIndicator />
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
      <HydrationBridge />
    </div>
  );
}
