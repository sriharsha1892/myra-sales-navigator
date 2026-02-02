"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useSearch } from "@/hooks/useSearch";

export function SearchBridge() {
  const pendingFreeTextSearch = useStore((s) => s.pendingFreeTextSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const pendingFilterSearch = useStore((s) => s.pendingFilterSearch);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const filters = useStore((s) => s.filters);
  const { search } = useSearch();

  useEffect(() => {
    if (pendingFreeTextSearch) {
      search({ freeText: pendingFreeTextSearch });
      setPendingFreeTextSearch(null);
    }
  }, [pendingFreeTextSearch, search, setPendingFreeTextSearch]);

  useEffect(() => {
    if (pendingFilterSearch) {
      search({ filters });
      setPendingFilterSearch(false);
    }
  }, [pendingFilterSearch, search, setPendingFilterSearch, filters]);

  return null;
}
