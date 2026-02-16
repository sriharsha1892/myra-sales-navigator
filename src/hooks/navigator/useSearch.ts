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

export interface SearchParams {
  filters?: FilterState;
  freeText?: string;
  signal?: AbortSignal;
}

interface DiscoverResponse {
  companies: CompanyEnriched[];
  extractedEntities?: ExtractedEntities;
  excludedCount?: number;
  errors?: SearchErrorDetail[];
  warnings?: string[];
  searchMeta?: SearchMeta;
  didYouMean?: { original: string; simplified: string } | null;
}

interface EnrichResponse {
  companies: CompanyEnriched[];
  nlIcpCriteria?: NLICPCriteria | null;
  errors?: SearchErrorDetail[];
  warnings?: string[];
  searchMeta?: SearchMeta;
}

async function twoPhaseSearch(params: SearchParams): Promise<DiscoverResponse & { enrichResponse?: EnrichResponse }> {
  const { signal, ...body } = params;

  // Phase 1: fast discover
  useStore.getState().setSearchPhase("discovering");
  const discoverRes = await fetch("/api/search/companies/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!discoverRes.ok) {
    const err = await discoverRes.json().catch(() => ({ error: "Discovery failed" }));
    throw new Error(err.error || "Discovery failed");
  }
  const discover: DiscoverResponse = await discoverRes.json();

  // Render Phase 1 results immediately
  const store = useStore.getState();
  store.setSearchResults(discover.companies);
  store.setSearchErrors(discover.errors ?? []);
  store.setSearchWarnings(discover.warnings ?? []);
  if (discover.extractedEntities) {
    store.setExtractedEntities(discover.extractedEntities);
  }
  store.setLastExcludedCount(discover.excludedCount ?? 0);
  store.setSearchMeta(discover.searchMeta ? {
    ...discover.searchMeta,
    didYouMean: discover.didYouMean ?? null,
  } : null);

  // If no companies discovered, skip enrichment
  if (!discover.companies || discover.companies.length === 0) {
    useStore.getState().setSearchPhase("done");
    return discover;
  }

  // Phase 2: enrich with Apollo + NL ICP (background)
  useStore.getState().setSearchPhase("enriching");
  try {
    const enrichRes = await fetch("/api/search/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        domains: discover.companies.map((c) => c.domain),
      }),
      signal,
    });
    if (!enrichRes.ok) {
      // Non-fatal — Phase 1 results still visible
      useStore.getState().setSearchPhase("done");
      return discover;
    }
    const enriched: EnrichResponse = await enrichRes.json();

    // Merge enriched data in-place
    const enrichStore = useStore.getState();
    if (enriched.companies?.length > 0) {
      enrichStore.mergeSearchResults(enriched.companies);
    }
    if (enriched.searchMeta) {
      enrichStore.setSearchMeta({
        ...enriched.searchMeta,
        didYouMean: discover.didYouMean ?? null,
      });
    }

    useStore.getState().setSearchPhase("done");
    return { ...discover, enrichResponse: enriched };
  } catch (err) {
    // Enrichment failure is non-fatal
    if ((err as Error).name !== "AbortError") {
      useStore.getState().setSearchPhase("done");
    }
    return discover;
  }
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
    mutationFn: twoPhaseSearch,
    onSuccess: (data) => {
      // Phase 1 results already set in twoPhaseSearch
      // Phase 2 results already merged in twoPhaseSearch
      setSearchError(null);
      // Merge errors/warnings from both phases
      const allErrors = [
        ...(data.errors ?? []),
        ...(data.enrichResponse?.errors ?? []),
      ];
      const allWarnings = [
        ...(data.warnings ?? []),
        ...(data.enrichResponse?.warnings ?? []),
      ];
      setSearchErrors(allErrors);
      setSearchWarnings(allWarnings);
      if (data.extractedEntities) {
        setExtractedEntities(data.extractedEntities);
      }
      setLastICPCriteria(data.enrichResponse?.nlIcpCriteria ?? null);
      setLastExcludedCount(data.excludedCount ?? 0);
    },
    onError: (error: Error) => {
      // Don't overwrite results for aborted searches
      if (error.name === "AbortError") return;
      setSearchResults([]);
      setSearchError(error.message);
      setSearchErrors([]);
      setSearchWarnings([]);
      useStore.getState().setSearchMeta(null);
      useStore.getState().setSearchPhase(null);
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
      useStore.getState().setSearchPhase(null);
    },
  };
}
