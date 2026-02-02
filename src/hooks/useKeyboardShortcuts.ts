"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

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
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
