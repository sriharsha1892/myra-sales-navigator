"use client";

import { useMutation } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import type { CompanyEnriched, FilterState, ExtractedEntities, NLICPCriteria } from "@/lib/navigator/types";

interface SearchParams {
  filters?: FilterState;
  freeText?: string;
}

interface SearchResponse {
  companies: CompanyEnriched[];
  extractedEntities?: ExtractedEntities;
  nlIcpCriteria?: NLICPCriteria | null;
}

async function searchCompanies(params: SearchParams): Promise<SearchResponse> {
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
  return {
    companies: data.companies ?? [],
    extractedEntities: data.extractedEntities ?? undefined,
    nlIcpCriteria: data.nlIcpCriteria ?? null,
  };
}

export function useSearch() {
  const setSearchResults = useStore((s) => s.setSearchResults);
  const setSearchError = useStore((s) => s.setSearchError);
  const setExtractedEntities = useStore((s) => s.setExtractedEntities);
  const setLastICPCriteria = useStore((s) => s.setLastICPCriteria);

  const mutation = useMutation({
    mutationFn: searchCompanies,
    onSuccess: (data) => {
      setSearchResults(data.companies);
      setSearchError(null);
      if (data.extractedEntities) {
        setExtractedEntities(data.extractedEntities);
      }
      setLastICPCriteria(data.nlIcpCriteria ?? null);
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
    searchResults: mutation.data?.companies ?? null,
    reset: () => {
      mutation.reset();
      setSearchResults(null);
      setSearchError(null);
      setExtractedEntities(null);
      setLastICPCriteria(null);
    },
  };
}
