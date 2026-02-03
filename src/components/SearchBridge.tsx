"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useSearch } from "@/hooks/useSearch";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { summarizeFilters } from "@/lib/utils";

export function SearchBridge() {
  const pendingFreeTextSearch = useStore((s) => s.pendingFreeTextSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const pendingFilterSearch = useStore((s) => s.pendingFilterSearch);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const setSearchLoading = useStore((s) => s.setSearchLoading);
  const setLastSearchQuery = useStore((s) => s.setLastSearchQuery);
  const filters = useStore((s) => s.filters);
  const { search } = useSearch();
  const { saveToHistory } = useSearchHistory();

  useEffect(() => {
    if (pendingFreeTextSearch) {
      const text = pendingFreeTextSearch;
      setSearchLoading(true);
      setLastSearchQuery(text);
      search(
        { freeText: text },
        {
          onSuccess: (data) => {
            saveToHistory(text, {}, data.companies.length);
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFreeTextSearch(null);
    }
  }, [pendingFreeTextSearch, search, setPendingFreeTextSearch, setSearchLoading, setLastSearchQuery, saveToHistory]);

  useEffect(() => {
    if (pendingFilterSearch) {
      const currentFilters = filters;
      setSearchLoading(true);
      setLastSearchQuery(summarizeFilters(currentFilters));
      search(
        { filters: currentFilters },
        {
          onSuccess: (data) => {
            saveToHistory(summarizeFilters(currentFilters), currentFilters, data.companies.length);
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFilterSearch(false);
    }
  }, [pendingFilterSearch, search, setPendingFilterSearch, setSearchLoading, setLastSearchQuery, filters, saveToHistory]);

  return null;
}
