"use client";

import { useMutation } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import type { CompanyEnriched, FilterState } from "@/lib/types";

interface SearchParams {
  filters?: FilterState;
  freeText?: string;
}

async function searchCompanies(params: SearchParams): Promise<CompanyEnriched[]> {
  const res = await fetch("/api/search/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Search failed" }));
    throw new Error(err.error || "Search failed");
  }
  const data = await res.json();
  return data.companies ?? [];
}

export function useSearch() {
  const setSearchResults = useStore((s) => s.setSearchResults);
  const setSearchError = useStore((s) => s.setSearchError);

  const mutation = useMutation({
    mutationFn: searchCompanies,
    onSuccess: (data) => {
      setSearchResults(data);
      setSearchError(null);
    },
    onError: (error: Error) => {
      setSearchResults([]);
      setSearchError(error.message);
    },
  });

  return {
    search: mutation.mutate,
    isSearching: mutation.isPending,
    searchError: mutation.error?.message ?? null,
    searchResults: mutation.data ?? null,
    reset: () => {
      mutation.reset();
      setSearchResults(null);
      setSearchError(null);
    },
  };
}
