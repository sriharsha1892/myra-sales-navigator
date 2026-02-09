"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/navigator/store";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      const state = useStore.getState();

      // Cmd+K — always open palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        state.setCommandPaletteOpen(true);
        return;
      }

      // Escape — close palette, slide-over, or deselect
      if (e.key === "Escape") {
        if (state.commandPaletteOpen) {
          state.setCommandPaletteOpen(false);
        } else if (state.slideOverOpen) {
          state.setSlideOverOpen(false);
        } else {
          state.selectCompany(null);
          state.deselectAllContacts();
          state.deselectAllCompanies();
        }
        return;
      }

      // Skip shortcuts when typing in inputs
      if (isInput) return;

      // Cmd+A — select all
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        if (e.shiftKey) {
          state.deselectAllContacts();
          state.deselectAllCompanies();
        } else {
          if (state.viewMode === "companies") {
            state.selectAllCompanies();
          } else {
            state.selectAllContacts();
          }
        }
        return;
      }

      // Cmd+Shift+E — express export (high-fit companies)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "e") {
        e.preventDefault();
        state.setTriggerExpressExport(true);
        return;
      }

      // Cmd+E — export
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        state.setTriggerExport("clipboard");
        return;
      }

      // Cmd+C — copy first contact email (only when no text selected)
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return; // let native copy work

        const domain = state.selectedCompanyDomain;
        if (!domain) return;

        const contacts = state.contactsByDomain[domain] ?? [];
        const withEmail = contacts.find((c) => c.email);
        if (withEmail?.email) {
          e.preventDefault();
          navigator.clipboard.writeText(withEmail.email).then(() => {
            state.addToast({ message: `Copied ${withEmail.email}`, type: "success", duration: 2000 });
          });
        }
        return;
      }

      // / — focus filter search
      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          "[data-filter-search]"
        );
        searchInput?.focus();
        return;
      }

      // ArrowDown — move to next result
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const results = state.searchResults ?? [];
        if (results.length === 0) return;
        const currentIndex = state.activeResultIndex ?? -1;
        const nextIndex = Math.min(currentIndex + 1, results.length - 1);
        state.setActiveResultIndex(nextIndex);
        const el = document.querySelector(`[data-result-index="${nextIndex}"]`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }

      // ArrowUp — move to previous result
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = state.activeResultIndex ?? 0;
        const prevIndex = Math.max(currentIndex - 1, 0);
        state.setActiveResultIndex(prevIndex);
        const el = document.querySelector(`[data-result-index="${prevIndex}"]`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }

      // Enter — select active result
      if (e.key === "Enter") {
        const results = state.searchResults ?? [];
        const idx = state.activeResultIndex;
        if (idx != null && idx >= 0 && idx < results.length) {
          e.preventDefault();
          state.selectCompany(results[idx].domain);
        }
        return;
      }

      // Space — toggle checkbox on active result
      if (e.key === " ") {
        const results = state.searchResults ?? [];
        const idx = state.activeResultIndex;
        if (idx != null && idx >= 0 && idx < results.length) {
          e.preventDefault();
          state.toggleCompanySelection(results[idx].domain);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
