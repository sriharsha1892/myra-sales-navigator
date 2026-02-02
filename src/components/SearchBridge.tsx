"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { useSearch } from "@/hooks/useSearch";

export function SearchBridge() {
  const pendingFreeTextSearch = useStore((s) => s.pendingFreeTextSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const { search } = useSearch();

  useEffect(() => {
    if (pendingFreeTextSearch) {
      search({ freeText: pendingFreeTextSearch });
      setPendingFreeTextSearch(null);
    }
  }, [pendingFreeTextSearch, search, setPendingFreeTextSearch]);

  return null;
}
