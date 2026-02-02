"use client";

import { useState, useCallback } from "react";
import { Command } from "cmdk";
import { useStore } from "@/lib/store";
import { Overlay } from "@/components/primitives/Overlay";
import { cn } from "@/lib/cn";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { timeAgo } from "@/lib/utils";

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const companies = useStore((s) => s.companies);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const selectCompany = useStore((s) => s.selectCompany);
  const setViewMode = useStore((s) => s.setViewMode);
  const resetFilters = useStore((s) => s.resetFilters);
  const addToast = useStore((s) => s.addToast);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);

  const setFilters = useStore((s) => s.setFilters);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const { history } = useSearchHistory();
  const [search, setSearch] = useState("");
  const inputRef = useCallback((node: HTMLInputElement | null) => {
    if (node && open) {
      setSearch("");
      setTimeout(() => node.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const allContacts = Object.values(contactsByDomain).flat();

  const handleExaSearch = () => {
    setPendingFreeTextSearch(search);
    setOpen(false);
  };

  return (
    <Overlay
      open={true}
      onClose={() => setOpen(false)}
      backdrop="dim"
      placement="top"
      trapFocus={false}
      closeOnEscape={false}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-card border border-surface-3 bg-surface-1 shadow-lg">
        <Command shouldFilter={true} label="Command palette">
          <div className="flex items-center border-b border-surface-3 px-4">
            <svg
              className="mr-2 h-4 w-4 text-text-tertiary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder="Search a company, industry, or describe your ideal prospect..."
              className="w-full bg-transparent py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-text-tertiary">
              No matches. Try a company name, industry, or description like &ldquo;packaging companies in Europe&rdquo;.
            </Command.Empty>

            {/* Exa free-text search */}
            {search.length > 2 && (
              <Command.Group heading="Search with Exa" className="mb-2">
                <CommandItem onSelect={handleExaSearch}>
                  <svg className="mr-2 h-3.5 w-3.5 text-source-exa" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Search Exa for &ldquo;{search}&rdquo;</span>
                </CommandItem>
              </Command.Group>
            )}

            {/* Recent Searches */}
            {history.length > 0 && (
              <Command.Group heading="Recent Searches" className="mb-2">
                {history.slice(0, 5).map((entry) => (
                  <CommandItem
                    key={entry.id}
                    onSelect={() => {
                      const f = entry.filters;
                      const hasFilters = f && (
                        (f.verticals?.length > 0) ||
                        (f.regions?.length > 0) ||
                        (f.sizes?.length > 0) ||
                        (f.signals?.length > 0)
                      );
                      if (hasFilters) {
                        setFilters(f);
                        setPendingFilterSearch(true);
                      } else {
                        setPendingFreeTextSearch(entry.label ?? "");
                      }
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{entry.label ?? "Search"}</span>
                    <span className="ml-auto font-mono text-[10px] text-text-tertiary">
                      {entry.resultCount} &middot; {timeAgo(entry.timestamp)}
                    </span>
                  </CommandItem>
                ))}
              </Command.Group>
            )}

            {/* Navigation Commands */}
            <Command.Group heading="Navigate" className="mb-2">
              <CommandItem
                onSelect={() => {
                  setViewMode("companies");
                  setOpen(false);
                }}
              >
                View Companies
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setViewMode("contacts");
                  setOpen(false);
                }}
              >
                View Contacts
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  resetFilters();
                  setOpen(false);
                  addToast({ message: "Filters reset", type: "info" });
                }}
              >
                Reset All Filters
              </CommandItem>
            </Command.Group>

            {/* Companies */}
            <Command.Group heading="Companies" className="mb-2">
              {companies.slice(0, 8).map((c) => (
                <CommandItem
                  key={c.domain}
                  onSelect={() => {
                    selectCompany(c.domain);
                    setOpen(false);
                  }}
                >
                  <span>{c.name}</span>
                  <span className="ml-auto font-mono text-xs text-text-tertiary">
                    ICP {c.icpScore}
                  </span>
                </CommandItem>
              ))}
            </Command.Group>

            {/* Contacts */}
            <Command.Group heading="Contacts">
              {allContacts.slice(0, 8).map((ct) => (
                <CommandItem
                  key={ct.id}
                  onSelect={() => {
                    selectCompany(ct.companyDomain);
                    setOpen(false);
                  }}
                >
                  <span>
                    {ct.firstName} {ct.lastName}
                  </span>
                  <span className="ml-auto font-mono text-xs text-text-tertiary">
                    {ct.companyName}
                  </span>
                </CommandItem>
              ))}
            </Command.Group>
          </Command.List>
        </Command>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-surface-3 px-4 py-2 text-[10px] text-text-tertiary">
          <span>Type to search &middot; &uarr;&darr; to navigate &middot; Enter to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </Overlay>
  );
}

function CommandItem({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center rounded-input px-3 py-2 text-sm text-text-secondary",
        "aria-selected:bg-accent-primary-light aria-selected:text-text-primary"
      )}
    >
      {children}
    </Command.Item>
  );
}
