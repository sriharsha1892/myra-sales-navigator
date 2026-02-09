"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/navigator/store";
import { useSearch } from "@/hooks/navigator/useSearch";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";
import { summarizeFilters } from "@/lib/utils";

export function SearchBridge() {
  const pendingFreeTextSearch = useStore((s) => s.pendingFreeTextSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const pendingFilterSearch = useStore((s) => s.pendingFilterSearch);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const setSearchLoading = useStore((s) => s.setSearchLoading);
  const setLastICPCriteria = useStore((s) => s.setLastICPCriteria);
  const setLastSearchQuery = useStore((s) => s.setLastSearchQuery);
  const filters = useStore((s) => s.filters);
  const { search } = useSearch();
  const { saveToHistory } = useSearchHistory();
  const { notify } = useBrowserNotifications();

  useEffect(() => {
    if (pendingFreeTextSearch) {
      const text = pendingFreeTextSearch;
      setSearchLoading(true);
      setLastSearchQuery(text);
      setLastICPCriteria(null);
      search(
        { freeText: text },
        {
          onSuccess: (data) => {
            saveToHistory(text, {}, data.companies.length);
            notify("Search complete", `${data.companies.length} companies found`);
          },
          onError: () => {
            notify("Search failed", "Something went wrong with your search");
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFreeTextSearch(null);
    }
  }, [pendingFreeTextSearch, search, setPendingFreeTextSearch, setSearchLoading, setLastSearchQuery, setLastICPCriteria, saveToHistory, notify]);

  useEffect(() => {
    if (pendingFilterSearch) {
      const currentFilters = filters;
      setSearchLoading(true);
      setLastSearchQuery(summarizeFilters(currentFilters));
      setLastICPCriteria(null);
      search(
        { filters: currentFilters },
        {
          onSuccess: (data) => {
            saveToHistory(summarizeFilters(currentFilters), currentFilters, data.companies.length);
            notify("Search complete", `${data.companies.length} companies found`);
          },
          onError: () => {
            notify("Search failed", "Something went wrong with your search");
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFilterSearch(false);
    }
  }, [pendingFilterSearch, search, setPendingFilterSearch, setSearchLoading, setLastSearchQuery, setLastICPCriteria, filters, saveToHistory, notify]);

  return null;
}
