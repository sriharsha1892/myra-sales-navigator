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
  const filters = useStore((s) => s.filters);
  const { search } = useSearch();
  const { saveToHistory } = useSearchHistory();

  useEffect(() => {
    if (pendingFreeTextSearch) {
      const text = pendingFreeTextSearch;
      setSearchLoading(true);
      search(
        { freeText: text },
        {
          onSuccess: (data) => {
            saveToHistory(text, {}, data.length);
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFreeTextSearch(null);
    }
  }, [pendingFreeTextSearch, search, setPendingFreeTextSearch, setSearchLoading, saveToHistory]);

  useEffect(() => {
    if (pendingFilterSearch) {
      const currentFilters = filters;
      setSearchLoading(true);
      search(
        { filters: currentFilters },
        {
          onSuccess: (data) => {
            saveToHistory(summarizeFilters(currentFilters), currentFilters, data.length);
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFilterSearch(false);
    }
  }, [pendingFilterSearch, search, setPendingFilterSearch, setSearchLoading, filters, saveToHistory]);

  return null;
}
