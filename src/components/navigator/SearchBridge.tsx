"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/navigator/store";
import { useSearch, type SearchParams } from "@/hooks/navigator/useSearch";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";
import { summarizeFilters, pLimit } from "@/lib/utils";
import type { FilterState } from "@/lib/navigator/types";

export function SearchBridge() {
  const pendingFreeTextSearch = useStore((s) => s.pendingFreeTextSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const pendingFilterSearch = useStore((s) => s.pendingFilterSearch);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const setSearchLoading = useStore((s) => s.setSearchLoading);
  const setLastICPCriteria = useStore((s) => s.setLastICPCriteria);
  const setLastSearchQuery = useStore((s) => s.setLastSearchQuery);
  const setSearchError = useStore((s) => s.setSearchError);
  const setLastSearchParams = useStore((s) => s.setLastSearchParams);
  const filters = useStore((s) => s.filters);
  const { search } = useSearch();
  const { saveToHistory } = useSearchHistory();
  const { notify } = useBrowserNotifications();

  // Abort controller for the main search request
  const searchAbortRef = useRef<AbortController | null>(null);

  // Post-search CRM enrichment — batch fetch Freshsales + HubSpot status
  const crmAbortRef = useRef<AbortController | null>(null);
  const enrichCrmStatus = (companies: import("@/lib/navigator/types").CompanyEnriched[]) => {
    crmAbortRef.current?.abort();
    const controller = new AbortController();
    crmAbortRef.current = controller;

    const limit = pLimit(3);
    const toEnrich = companies.filter(
      (c) => c.freshsalesStatus === "none" && c.hubspotStatus === "none"
    );

    if (toEnrich.length === 0) return;

    useStore.getState().setCrmEnrichmentInProgress(true);
    useStore.getState().incrementBackgroundNetwork();

    const promises = toEnrich.map((company) =>
      limit(async (): Promise<"ok" | "fail"> => {
        if (controller.signal.aborted) return "fail";
        try {
          const nameParam = company.name && company.name !== company.domain
            ? `&name=${encodeURIComponent(company.name)}`
            : "";
          const res = await fetch(
            `/api/company/${encodeURIComponent(company.domain)}?crmOnly=true${nameParam}`,
            { signal: controller.signal }
          );
          if (!res.ok) return "fail";
          const data = await res.json();
          if (data.freshsalesStatus !== "none" || data.hubspotStatus !== "none") {
            useStore.getState().updateCompanyCrmStatus(
              company.domain,
              data.freshsalesStatus,
              data.freshsalesIntel,
              data.hubspotStatus
            );
          }
          return "ok";
        } catch {
          return "fail";
        }
      })
    );

    Promise.allSettled(promises).then((results) => {
      useStore.getState().setCrmEnrichmentInProgress(false);
      useStore.getState().decrementBackgroundNetwork();
      const failCount = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value === "fail")
      ).length;
      if (failCount === toEnrich.length && toEnrich.length > 0) {
        useStore.getState().addToast({
          message: "CRM status check failed for all companies",
          type: "warning",
          duration: 4000,
        });
      }
    });
  };

  // Pre-warm contacts for top companies after search completes
  const preWarmAbortRef = useRef<AbortController | null>(null);
  const preWarmContacts = (companies: import("@/lib/navigator/types").CompanyEnriched[]) => {
    // Abort any previous pre-warm cycle
    preWarmAbortRef.current?.abort();
    const controller = new AbortController();
    preWarmAbortRef.current = controller;

    const exactMatches = companies.filter((c) => c.exactMatch);
    const rest = [...companies]
      .filter((c) => !c.exactMatch)
      .sort((a, b) => b.icpScore - a.icpScore)
      .slice(0, 10 - exactMatches.length);
    const top10 = [...exactMatches, ...rest];

    const limit = pLimit(3);
    const store = useStore.getState();

    // Filter to companies needing pre-warm
    const needPreWarm = top10.filter((c) => !store.contactsByDomain[c.domain]?.length);
    if (needPreWarm.length > 0) {
      store.setEnrichmentProgress({ total: needPreWarm.length, completed: 0 });
    }

    useStore.getState().incrementBackgroundNetwork();

    const preWarmPromises = needPreWarm.map((company) =>
      limit(async () => {
        if (controller.signal.aborted) return;
        try {
          const nameParam = company.name && company.name !== company.domain
            ? `?name=${encodeURIComponent(company.name)}`
            : "";
          const res = await fetch(
            `/api/company/${encodeURIComponent(company.domain)}/contacts${nameParam}`,
            { signal: controller.signal }
          );
          if (!res.ok) return;
          const data = await res.json();
          if (data.contacts?.length) {
            useStore.getState().setContactsForDomain(company.domain, data.contacts);
          }
        } catch {
          // Silent — pre-warming is best-effort
        } finally {
          useStore.getState().incrementEnrichmentCompleted();
        }
      })
    );

    // Always clear enrichment progress when all pre-warm tasks finish
    Promise.allSettled(preWarmPromises).then(() => {
      useStore.getState().setEnrichmentProgress(null);
      useStore.getState().decrementBackgroundNetwork();
    });
  };

  // Post-search team activity enrichment
  const teamActivityAbortRef = useRef<AbortController | null>(null);
  const enrichTeamActivity = (companies: import("@/lib/navigator/types").CompanyEnriched[]) => {
    teamActivityAbortRef.current?.abort();
    const controller = new AbortController();
    teamActivityAbortRef.current = controller;

    const domains = companies.map((c) => c.domain);
    const userName = useStore.getState().userName;
    if (!userName || domains.length === 0) return;

    useStore.getState().incrementBackgroundNetwork();

    fetch("/api/team-activity/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domains, currentUser: userName }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        useStore.getState().mergeTeamActivity(data);
      })
      .catch(() => { /* silent */ })
      .finally(() => useStore.getState().decrementBackgroundNetwork());
  };

  // Post-search similar search detection
  const fetchSimilarSearch = (queryText: string, userName: string) => {
    fetch(`/api/team-activity/similar-searches?query=${encodeURIComponent(queryText)}&user=${encodeURIComponent(userName)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data.match) {
          useStore.getState().setSimilarSearchMatch(data.match);
        }
      })
      .catch(() => { /* silent */ });
  };

  // Unified search effect: handles freeText, filters, or both
  useEffect(() => {
    const hasFreeText = !!pendingFreeTextSearch;
    const hasFilter = pendingFilterSearch;
    if (!hasFreeText && !hasFilter) return;

    const text = pendingFreeTextSearch ?? null;
    const currentFilters = filters;

    // Abort any in-flight search
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    // Store cancel function for UI cancel button
    useStore.getState().setCancelSearch(() => controller.abort());

    // Build combined search params for the API
    const searchParams: SearchParams = {
      signal: controller.signal,
    };
    if (text) searchParams.freeText = text;
    // Pass filters alongside freeText (unified), or alone for filter-only searches
    if (hasFilter || text) searchParams.filters = currentFilters;

    // Build lastSearchParams — combined state for retry
    const combinedParams: { freeText?: string; filters?: FilterState } = {};
    if (text) combinedParams.freeText = text;
    combinedParams.filters = currentFilters;

    const queryLabel = text ?? summarizeFilters(currentFilters);

    setSearchLoading(true);
    setSearchError(null);
    setLastSearchQuery(queryLabel);
    setLastICPCriteria(null);
    setLastSearchParams(combinedParams);
    useStore.getState().setSearchMeta(null);
    useStore.getState().setEnrichmentProgress(null);
    useStore.getState().setSearchPhase("discovering");

    search(searchParams, {
      onSuccess: (data) => {
        // Phase 1 results rendered by twoPhaseSearch, start post-search enrichment
        const companies = useStore.getState().searchResults ?? data.companies;
        saveToHistory(queryLabel, currentFilters, companies.length);
        notify("Search complete", `${companies.length} companies found`);
        preWarmContacts(companies);
        enrichCrmStatus(companies);
        enrichTeamActivity(companies);
        fetchSimilarSearch(queryLabel, useStore.getState().userName ?? "");
        useStore.getState().incrementSessionSearchCount();

        // Auto-open dossier for exact match (company-name searches)
        const exactMatch = companies.find((c: { exactMatch?: boolean }) => c.exactMatch);
        if (exactMatch) {
          requestAnimationFrame(() => {
            const current = useStore.getState().searchResults;
            if (current?.some((c) => c.domain === exactMatch.domain)) {
              useStore.getState().selectCompany(exactMatch.domain);
            }
          });
        }
      },
      onError: (error: Error) => {
        if (error.name === "AbortError") return;
        notify("Search failed", "Something went wrong with your search");
      },
      onSettled: (_data, error) => {
        if (error?.name === "AbortError") return;
        setSearchLoading(false);
        useStore.getState().setCancelSearch(null);
      },
    });

    // Clear pending triggers
    if (hasFreeText) setPendingFreeTextSearch(null);
    if (hasFilter) setPendingFilterSearch(false);
  }, [pendingFreeTextSearch, pendingFilterSearch, search, setPendingFreeTextSearch, setPendingFilterSearch, setSearchLoading, setSearchError, setLastSearchQuery, setLastICPCriteria, setLastSearchParams, filters, saveToHistory, notify]);

  return null;
}
