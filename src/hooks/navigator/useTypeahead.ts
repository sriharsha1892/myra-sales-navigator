"use client";

import { useMemo } from "react";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { useStore } from "@/lib/navigator/store";
import type { SearchHistoryEntry, SearchPreset, CompanyEnriched } from "@/lib/navigator/types";

export interface TypeaheadItem {
  type: "recent" | "preset" | "company";
  label: string;
  id: string;
  entry?: SearchHistoryEntry;
  preset?: SearchPreset;
  company?: CompanyEnriched;
}

export function useTypeahead(query: string) {
  const { history } = useSearchHistory();
  const presets = useStore((s) => s.presets);
  const searchResults = useStore((s) => s.searchResults);
  const companies = useStore((s) => s.companies);

  const allCompanies = searchResults ?? companies;

  return useMemo(() => {
    const q = query.toLowerCase().trim();

    const recentSearches: TypeaheadItem[] = history
      .filter((h) => !q || (h.label ?? "").toLowerCase().includes(q))
      .slice(0, 5)
      .map((h) => ({
        type: "recent" as const,
        label: h.label ?? "Search",
        id: `recent-${h.id}`,
        entry: h,
      }));

    const matchingPresets: TypeaheadItem[] = presets
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({
        type: "preset" as const,
        label: p.name,
        id: `preset-${p.id}`,
        preset: p,
      }));

    const matchingCompanies: TypeaheadItem[] =
      q.length >= 2
        ? allCompanies
            .filter((c) => c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q))
            .slice(0, 5)
            .map((c) => ({
              type: "company" as const,
              label: c.name,
              id: `company-${c.domain}`,
              company: c,
            }))
        : [];

    const items = [...recentSearches, ...matchingPresets, ...matchingCompanies];

    return {
      recentSearches,
      matchingPresets,
      matchingCompanies,
      items,
      isEmpty: items.length === 0,
    };
  }, [query, history, presets, allCompanies]);
}
