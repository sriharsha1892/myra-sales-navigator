"use client";

import { useMutation } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import type {
  CompanyEnriched,
  FilterState,
  ExtractedEntities,
  NLICPCriteria,
  SearchErrorDetail,
  SearchMeta,
} from "@/lib/navigator/types";

interface SearchParams {
  filters?: FilterState;
  freeText?: string;
  signal?: AbortSignal;
}

interface SearchResponse {
  companies: CompanyEnriched[];
  extractedEntities?: ExtractedEntities;
  nlIcpCriteria?: NLICPCriteria | null;
  excludedCount?: number;
  errors?: SearchErrorDetail[];
  warnings?: string[];
  searchMeta?: SearchMeta;
}

async function searchCompanies(params: SearchParams): Promise<SearchResponse> {
  const { signal, ...body } = params;
  const res = await fetch("/api/search/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
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
    excludedCount: data.excludedCount ?? 0,
    errors: data.errors ?? [],
    warnings: data.warnings ?? [],
    searchMeta: data.searchMeta ?? undefined,
  };
}

export function useSearch() {
  const setSearchResults = useStore((s) => s.setSearchResults);
  const setSearchError = useStore((s) => s.setSearchError);
  const setSearchErrors = useStore((s) => s.setSearchErrors);
  const setSearchWarnings = useStore((s) => s.setSearchWarnings);
  const setExtractedEntities = useStore((s) => s.setExtractedEntities);
  const setLastICPCriteria = useStore((s) => s.setLastICPCriteria);
  const setLastExcludedCount = useStore((s) => s.setLastExcludedCount);

  const mutation = useMutation({
    mutationFn: searchCompanies,
    onSuccess: (data) => {
      setSearchResults(data.companies);
      setSearchError(null);
      setSearchErrors(data.errors ?? []);
      setSearchWarnings(data.warnings ?? []);
      if (data.extractedEntities) {
        setExtractedEntities(data.extractedEntities);
      }
      setLastICPCriteria(data.nlIcpCriteria ?? null);
      setLastExcludedCount(data.excludedCount ?? 0);
    },
    onError: (error: Error) => {
      // Don't overwrite results for aborted searches
      if (error.name === "AbortError") return;
      setSearchResults([]);
      setSearchError(error.message);
      setSearchErrors([]);
      setSearchWarnings([]);
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
      setSearchErrors([]);
      setSearchWarnings([]);
      setExtractedEntities(null);
      setLastICPCriteria(null);
      setLastExcludedCount(0);
    },
  };
}
