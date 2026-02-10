"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/navigator/store";
import { useSearch } from "@/hooks/navigator/useSearch";
import { useSearchHistory } from "@/hooks/navigator/useSearchHistory";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";
import { summarizeFilters, pLimit } from "@/lib/utils";

export function SearchBridge() {
  const pendingFreeTextSearch = useStore((s) => s.pendingFreeTextSearch);
  const setPendingFreeTextSearch = useStore((s) => s.setPendingFreeTextSearch);
  const pendingFilterSearch = useStore((s) => s.pendingFilterSearch);
  const setPendingFilterSearch = useStore((s) => s.setPendingFilterSearch);
  const setSearchLoading = useStore((s) => s.setSearchLoading);
  const setLastICPCriteria = useStore((s) => s.setLastICPCriteria);
  const setLastSearchQuery = useStore((s) => s.setLastSearchQuery);
  const setSearchError = useStore((s) => s.setSearchError);
  const filters = useStore((s) => s.filters);
  const { search } = useSearch();
  const { saveToHistory } = useSearchHistory();
  const { notify } = useBrowserNotifications();

  // Post-search CRM enrichment — batch fetch Freshsales + HubSpot status
  const crmAbortRef = useRef<AbortController | null>(null);
  const enrichCrmStatus = (companies: import("@/lib/navigator/types").CompanyEnriched[]) => {
    crmAbortRef.current?.abort();
    const controller = new AbortController();
    crmAbortRef.current = controller;

    const limit = pLimit(3);
    for (const company of companies) {
      // Skip if already has CRM data
      if (company.freshsalesStatus !== "none" || company.hubspotStatus !== "none") continue;

      limit(async () => {
        if (controller.signal.aborted) return;
        try {
          const nameParam = company.name && company.name !== company.domain
            ? `&name=${encodeURIComponent(company.name)}`
            : "";
          const res = await fetch(
            `/api/company/${encodeURIComponent(company.domain)}?crmOnly=true${nameParam}`,
            { signal: controller.signal }
          );
          if (!res.ok) return;
          const data = await res.json();
          if (data.freshsalesStatus !== "none" || data.hubspotStatus !== "none") {
            useStore.getState().updateCompanyCrmStatus(
              company.domain,
              data.freshsalesStatus,
              data.freshsalesIntel,
              data.hubspotStatus
            );
          }
        } catch {
          // Silent — CRM enrichment is best-effort
        }
      });
    }
  };

  // Pre-warm contacts for top companies after search completes
  const preWarmAbortRef = useRef<AbortController | null>(null);
  const preWarmContacts = (companies: import("@/lib/navigator/types").CompanyEnriched[]) => {
    // Abort any previous pre-warm cycle
    preWarmAbortRef.current?.abort();
    const controller = new AbortController();
    preWarmAbortRef.current = controller;

    const top10 = [...companies]
      .sort((a, b) => b.icpScore - a.icpScore)
      .slice(0, 10);

    const limit = pLimit(3);
    const store = useStore.getState();

    for (const company of top10) {
      // Skip if contacts already cached
      if (store.contactsByDomain[company.domain]?.length) continue;

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
        }
      });
    }
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
      .catch(() => { /* silent */ });
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

  useEffect(() => {
    if (pendingFreeTextSearch) {
      const text = pendingFreeTextSearch;
      setSearchLoading(true);
      setSearchError(null);
      setLastSearchQuery(text);
      setLastICPCriteria(null);
      search(
        { freeText: text },
        {
          onSuccess: (data) => {
            saveToHistory(text, {}, data.companies.length);
            notify("Search complete", `${data.companies.length} companies found`);
            preWarmContacts(data.companies);
            enrichCrmStatus(data.companies);
            enrichTeamActivity(data.companies);
            fetchSimilarSearch(text, useStore.getState().userName ?? "");
            useStore.getState().incrementSessionSearchCount();
          },
          onError: () => {
            notify("Search failed", "Something went wrong with your search");
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFreeTextSearch(null);
    }
  }, [pendingFreeTextSearch, search, setPendingFreeTextSearch, setSearchLoading, setSearchError, setLastSearchQuery, setLastICPCriteria, saveToHistory, notify]);

  useEffect(() => {
    if (pendingFilterSearch) {
      const currentFilters = filters;
      setSearchLoading(true);
      setSearchError(null);
      setLastSearchQuery(summarizeFilters(currentFilters));
      setLastICPCriteria(null);
      search(
        { filters: currentFilters },
        {
          onSuccess: (data) => {
            saveToHistory(summarizeFilters(currentFilters), currentFilters, data.companies.length);
            notify("Search complete", `${data.companies.length} companies found`);
            preWarmContacts(data.companies);
            enrichCrmStatus(data.companies);
            enrichTeamActivity(data.companies);
            fetchSimilarSearch(summarizeFilters(currentFilters), useStore.getState().userName ?? "");
            useStore.getState().incrementSessionSearchCount();
          },
          onError: () => {
            notify("Search failed", "Something went wrong with your search");
          },
          onSettled: () => setSearchLoading(false),
        }
      );
      setPendingFilterSearch(false);
    }
  }, [pendingFilterSearch, search, setPendingFilterSearch, setSearchLoading, setSearchError, setLastSearchQuery, setLastICPCriteria, filters, saveToHistory, notify]);

  return null;
}
