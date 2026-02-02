"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { FilterSection } from "@/components/filters/FilterSection";
import { VerticalFilter } from "@/components/filters/VerticalFilter";
import { RegionFilter } from "@/components/filters/RegionFilter";
import { SizeFilter } from "@/components/filters/SizeFilter";
import { SignalFilter } from "@/components/filters/SignalFilter";
import { ExclusionToggle } from "@/components/filters/ExclusionToggle";
import { IcpScoreBadge } from "@/components/badges";
import { HelpTip } from "@/components/shared/HelpTip";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { timeAgo } from "@/lib/utils";

export function FilterPanel() {
  const presets = useStore((s) => s.presets);
  const loadPreset = useStore((s) => s.loadPreset);
  const savePreset = useStore((s) => s.savePreset);
  const deletePreset = useStore((s) => s.deletePreset);
  const resetFilters = useStore((s) => s.resetFilters);
  const recentDomains = useStore((s) => s.recentDomains);
  const companies = useStore((s) => s.companies);
  const selectCompany = useStore((s) => s.selectCompany);
  const addToast = useStore((s) => s.addToast);
  const addUndoToast = useStore((s) => s.addUndoToast);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const { history } = useSearchHistory();

  const [presetName, setPresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);

  // Active filter count
  const activeFilterCount =
    filters.verticals.length +
    filters.regions.length +
    filters.sizes.length +
    filters.signals.length +
    filters.quickFilters.length;

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    addToast({ message: `Preset "${presetName.trim()}" saved`, type: "success" });
    setPresetName("");
    setShowSavePreset(false);
  };

  const handleDeletePreset = (id: string, name: string) => {
    const preset = presets.find((p) => p.id === id);
    deletePreset(id);
    addUndoToast(`Deleted preset "${name}"`, () => {
      if (preset) {
        // Re-add manually via store
        useStore.getState().savePreset(preset.name);
      }
    });
  };

  const recentCompanyData = recentDomains
    .map((domain) => companies.find((c) => c.domain === domain))
    .filter(Boolean);

  const searchResults = useStore((s) => s.searchResults);
  const hasSearched = searchResults !== null;

  return (
    <div className="glass-panel flex h-full flex-col overflow-y-auto">
      {/* Header + Search */}
      <div className="border-b border-surface-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-medium text-text-primary">Refine Results</h2>
          {activeFilterCount > 0 && (
            <span
              key={activeFilterCount}
              className="flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-primary px-1.5 text-[10px] font-semibold text-text-inverse"
              style={{ animation: "scaleIn 180ms ease-out" }}
            >
              {activeFilterCount}
            </span>
          )}
        </div>
        {!hasSearched && (
          <p className="mt-1.5 text-xs italic text-text-tertiary">Run a search first, then refine here</p>
        )}
        <button
          onClick={() => useStore.getState().setPendingFilterSearch(true)}
          disabled={filters.verticals.length + filters.regions.length + filters.sizes.length + filters.signals.length === 0}
          className="mt-3 w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Re-search with Filters
        </button>
      </div>

      {/* Presets */}
      <div className="border-b border-surface-3 px-4 py-3">
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Saved Presets
        </label>
        {/* Custom dropdown for presets (allows delete button) */}
        <div className="relative">
          <button
            onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
            className="flex w-full items-center justify-between rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          >
            <span className="text-text-secondary">Select a preset...</span>
            <svg
              className={`h-3 w-3 text-text-tertiary transition-transform ${presetDropdownOpen ? "rotate-180" : ""}`}
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
          {presetDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-input border border-surface-3 bg-surface-1 py-1 shadow-md">
              {presets.length === 0 && (
                <p className="px-2 py-1.5 text-xs italic text-text-tertiary">No presets saved</p>
              )}
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center gap-1 px-2 py-1 hover:bg-surface-2"
                >
                  <button
                    onClick={() => {
                      loadPreset(p.id);
                      setPresetDropdownOpen(false);
                    }}
                    className="flex-1 text-left text-xs text-text-primary"
                  >
                    {p.name} <span className="text-text-tertiary">(by {p.createdBy})</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePreset(p.id, p.name);
                    }}
                    className="flex-shrink-0 text-text-tertiary opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    title="Delete preset"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {!showSavePreset ? (
            <button
              onClick={() => setShowSavePreset(true)}
              className="text-[10px] text-text-tertiary hover:text-accent-primary"
            >
              Save as Preset
            </button>
          ) : (
            <div className="flex w-full gap-1">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
              />
              <button onClick={handleSavePreset} className="rounded-input bg-accent-primary px-2 py-1 text-xs font-medium text-text-inverse">
                Save
              </button>
            </div>
          )}
          <button
            onClick={resetFilters}
            className="ml-auto text-[10px] text-text-tertiary hover:text-text-secondary"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Recent Searches */}
      {history.length > 0 && (
        <div className="border-b border-surface-3 px-4 py-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Recent Searches
          </label>
          <div className="space-y-0.5">
            {history.slice(0, 5).map((entry) => {
              const handleClick = () => {
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
              };
              return (
                <button
                  key={entry.id}
                  onClick={handleClick}
                  className="flex w-full items-center justify-between rounded-input px-2.5 py-2 text-sm text-text-secondary hover:bg-surface-2"
                >
                  <span className="truncate">{entry.label ?? "Search"}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-xs text-text-tertiary">{entry.resultCount}</span>
                    <span className="text-xs text-text-tertiary">{timeAgo(entry.timestamp)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Companies */}
      {recentCompanyData.length > 0 && (
        <div className="border-b border-surface-3 px-4 py-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Recent
          </label>
          <div className="space-y-0.5">
            {recentCompanyData.slice(0, 5).map((company) =>
              company ? (
                <button
                  key={company.domain}
                  onClick={() => selectCompany(company.domain)}
                  className="flex w-full items-center justify-between rounded-input px-2.5 py-2 text-sm text-text-secondary hover:bg-surface-2"
                >
                  <span className="truncate">{company.name}</span>
                  <IcpScoreBadge score={company.icpScore} className="scale-90" />
                </button>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Filter Sections */}
      <FilterSection title={<span className="inline-flex items-center gap-1">Vertical <HelpTip text="Industry or market segment, like Food Ingredients or Chemicals." /></span>} defaultOpen={false} count={filters.verticals.length} onClear={() => setFilters({ verticals: [] })}>
        <VerticalFilter />
      </FilterSection>

      <FilterSection title="Region" defaultOpen={false} count={filters.regions.length} onClear={() => setFilters({ regions: [] })}>
        <RegionFilter />
      </FilterSection>

      <FilterSection title="Company Size" defaultOpen={false} count={filters.sizes.length} onClear={() => setFilters({ sizes: [] })}>
        <SizeFilter />
      </FilterSection>

      <FilterSection title={<span className="inline-flex items-center gap-1">Signals <HelpTip text="Recent activity like hiring, funding, or expansion — signs a company might be ready to buy." /></span>} defaultOpen={false} count={filters.signals.length} onClear={() => setFilters({ signals: [] })}>
        <SignalFilter />
      </FilterSection>

      <FilterSection title={<span className="inline-flex items-center gap-1">Exclusions <HelpTip text="Companies or contacts your team has already ruled out. Hidden from results when this filter is on." /></span>} defaultOpen={false}>
        <ExclusionToggle />
      </FilterSection>
    </div>
  );
}
