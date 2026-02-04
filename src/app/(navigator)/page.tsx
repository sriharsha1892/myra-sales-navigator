"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/navigator/layout/AppShell";
import { CommandPalette } from "@/components/navigator/command/CommandPalette";
import { BulkActionBar } from "@/components/navigator/shared";
import { UserSettingsPanel } from "@/components/navigator/settings/UserSettingsPanel";
import { SearchBridge } from "@/components/navigator/SearchBridge";
import { HydrationBridge } from "@/components/navigator/HydrationBridge";
import { ExtractedChips } from "@/components/navigator/shared/ExtractedChips";
import { useKeyboardShortcuts } from "@/hooks/navigator/useKeyboardShortcuts";
import { useAuth } from "@/providers/AuthProvider";
import { useStore } from "@/lib/navigator/store";
import { MentionNotifications } from "@/components/navigator/MentionNotifications";
import { ChatWidget } from "@/components/navigator/chat/ChatWidget";
import { TeamPulseWidget } from "@/components/navigator/shared/TeamPulseWidget";

const hintQueries = [
  "food ingredients expanding to Asia",
  "SaaS companies hiring in Europe",
  "chemicals near Brenntag competitors",
];

export default function Home() {
  const { userName, isLoading } = useAuth();
  const isCommandPaletteOpen = useStore((s) => s.commandPaletteOpen);
  const searchLoading = useStore((s) => s.searchLoading);
  const searchResults = useStore((s) => s.searchResults);
  const selectedCompanyDomain = useStore((s) => s.selectedCompanyDomain);
  const selectCompany = useStore((s) => s.selectCompany);
  const setSearchResults = useStore((s) => s.setSearchResults);
  const setSearchError = useStore((s) => s.setSearchError);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Typing effect state
  const [typingText, setTypingText] = useState("");
  const [typingActive, setTypingActive] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  useKeyboardShortcuts();

  // First-visit typing effect + glow
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("nav_search_hinted")) return;

    let cancelled = false;
    // Defer initial setState to avoid synchronous setState-in-effect
    requestAnimationFrame(() => {
      if (cancelled) return;
      setTypingActive(true);
      setShowGlow(true);
    });

    async function runTyping() {
      for (let qi = 0; qi < hintQueries.length; qi++) {
        const query = hintQueries[qi];
        // Type each character
        for (let ci = 0; ci <= query.length; ci++) {
          if (cancelled) return;
          setTypingText(query.slice(0, ci));
          await new Promise((r) => setTimeout(r, 40));
        }
        // Pause
        await new Promise((r) => setTimeout(r, 1500));
        // Clear
        if (cancelled) return;
        setTypingText("");
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!cancelled) {
        setTypingActive(false);
        setShowGlow(false);
        localStorage.setItem("nav_search_hinted", "1");
      }
    }

    runTyping();
    return () => { cancelled = true; };
  }, []);

  // Stop typing on focus
  const handleSearchFocus = () => {
    if (typingActive) {
      setTypingActive(false);
      setTypingText("");
      setShowGlow(false);
      localStorage.setItem("nav_search_hinted", "1");
    }
  };

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

  const placeholder = typingActive && typingText
    ? typingText
    : "Search companies or press \u2318K for smart search...";

  return (
    <div className="animate-fadeInUp relative h-screen overflow-hidden bg-surface-0 ambient-header">
      {/* Top bar */}
      <div className="bg-surface-0 border-b border-surface-3 flex h-14 flex-shrink-0 items-center justify-between shadow-sm px-5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg text-intel">myRA</h1>
          <span className="text-xs text-text-tertiary">Sales Navigator</span>
          {(searchResults !== null || selectedCompanyDomain !== null) && (
            <button
              onClick={() => {
                selectCompany(null);
                setSearchResults(null);
                setSearchError(null);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-input text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
              title="Home"
              aria-label="Home"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
          )}
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
            onFocus={handleSearchFocus}
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
            placeholder={placeholder}
            className={`w-full rounded-pill border border-surface-3 bg-surface-2 py-2 pl-9 pr-16 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-[180ms] focus:border-accent-primary focus:shadow-[0_0_0_3px_var(--color-accent-primary-light)] focus:outline-none${showGlow ? " animate-[searchGlow_2s_ease-in-out_3]" : ""}`}
          />
          <kbd
            onClick={() => useStore.getState().setCommandPaletteOpen(true)}
            className="absolute right-3 cursor-pointer rounded border border-surface-3 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary hover:text-text-secondary"
          >
            &#8984;K
          </kbd>
        </div>

        <div className="flex items-center gap-3">
          <MentionNotifications />
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-intel text-xs font-semibold text-text-inverse"
            title={userName ?? "Settings"}
          >
            {userName?.[0]?.toUpperCase() ?? "?"}
          </button>
        </div>
      </div>

      {/* Main content — flex column to accommodate chips */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        <ExtractedChips />
        <div className="flex-1 overflow-hidden">
          <AppShell />
        </div>
      </div>

      {/* Overlays */}
      {isCommandPaletteOpen && <CommandPalette />}
      <UserSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BulkActionBar />
      <SearchBridge />
      <HydrationBridge />
      <ChatWidget />
      <TeamPulseWidget />
    </div>
  );
}
