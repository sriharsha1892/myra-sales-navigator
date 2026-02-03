"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import type { CompanyEnriched, Contact, Signal } from "@/lib/types";

async function fetchCompany(domain: string, companyName?: string): Promise<CompanyEnriched> {
  const nameParam = companyName ? `?name=${encodeURIComponent(companyName)}` : "";
  const res = await fetch(`/api/company/${encodeURIComponent(domain)}${nameParam}`);
  if (!res.ok) throw new Error("Failed to load company");
  const data = await res.json();

  // The API returns { company, sources: { apollo, hubspot }, aiSummary, freshsalesAvailable }.
  // Merge into a single CompanyEnriched, ensuring sources stays an array.
  const company = data.company ?? {};

  // Fallback: merge Exa search result data from store for fields Apollo didn't fill
  const storeResults = useStore.getState().searchResults;
  const storeCompany = storeResults?.find((c) => c.domain === domain) ?? null;

  const sourcesArr: string[] = Array.isArray(company.sources) ? company.sources : [];
  if (data.sources?.apollo && !sourcesArr.includes("apollo")) sourcesArr.push("apollo");
  if (data.sources?.hubspot && !sourcesArr.includes("hubspot")) sourcesArr.push("hubspot");
  if (data.sources?.freshsales && !sourcesArr.includes("freshsales")) sourcesArr.push("freshsales");
  // Merge store sources too
  if (storeCompany?.sources) {
    for (const s of storeCompany.sources) {
      if (!sourcesArr.includes(s)) sourcesArr.push(s);
    }
  }
  const freshsalesAvailable: boolean = data.freshsalesAvailable ?? false;

  const now = new Date().toISOString();

  // Helper: use API value if truthy, else store (Exa) value, else fallback
  const f = <T>(apiVal: T, storeVal: T | undefined, fallback: T): T =>
    apiVal || storeVal || fallback;

  return {
    // Anchor field defaults
    domain: company.domain ?? domain,
    name: f(company.name, storeCompany?.name, domain),
    firstViewedBy: company.firstViewedBy ?? "",
    firstViewedAt: company.firstViewedAt ?? now,
    lastViewedBy: company.lastViewedBy ?? "",
    lastViewedAt: company.lastViewedAt ?? now,
    source: company.source ?? "",
    noteCount: company.noteCount ?? 0,
    lastNoteAt: company.lastNoteAt ?? null,
    extractionCount: company.extractionCount ?? 0,
    lastExtractionAt: company.lastExtractionAt ?? null,
    excluded: company.excluded ?? false,
    excludedBy: company.excludedBy ?? null,
    excludedAt: company.excludedAt ?? null,
    exclusionReason: company.exclusionReason ?? null,

    // Enrichment field defaults — fallback to store (Exa) data
    industry: f(company.industry, storeCompany?.industry, ""),
    vertical: f(company.vertical, storeCompany?.vertical, ""),
    employeeCount: company.employeeCount || storeCompany?.employeeCount || 0,
    location: f(company.location, storeCompany?.location, ""),
    region: f(company.region, storeCompany?.region, ""),
    description: f(company.description, storeCompany?.description, ""),
    icpScore: company.icpScore || storeCompany?.icpScore || 0,
    hubspotStatus: company.hubspotStatus ?? data.hubspotStatus?.status ?? "none",
    freshsalesStatus: company.freshsalesStatus ?? data.freshsalesIntel?.status ?? "none",
    freshsalesIntel: data.freshsalesIntel ?? null,
    freshsalesAvailable,
    sources: sourcesArr,
    signals: Array.isArray(company.signals) ? company.signals : [],
    contactCount: company.contactCount ?? 0,
    lastRefreshed: company.lastRefreshed ?? now,

    // Optional fields — pass through if present, fallback to store
    logoUrl: company.logoUrl || storeCompany?.logoUrl,
    revenue: company.revenue || storeCompany?.revenue,
    founded: company.founded || storeCompany?.founded,
    website: company.website || storeCompany?.website,
    phone: company.phone || storeCompany?.phone,
    aiSummary: data.aiSummary ?? company.aiSummary,
  } as CompanyEnriched;
}

async function fetchContacts(domain: string, companyName?: string, refresh?: boolean): Promise<Contact[]> {
  const params = new URLSearchParams();
  if (companyName) params.set("name", companyName);
  if (refresh) params.set("refresh", "true");
  const qs = params.toString();
  const res = await fetch(`/api/company/${encodeURIComponent(domain)}/contacts${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load contacts");
  const data = await res.json();
  return data.contacts ?? [];
}

async function fetchSignals(domain: string): Promise<Signal[]> {
  const res = await fetch(`/api/company/${encodeURIComponent(domain)}/signals`);
  if (!res.ok) throw new Error("Failed to load signals");
  const data = await res.json();
  return data.signals ?? [];
}

export function useCompanyDossier(domain: string | null) {
  // Look up company name from search results for Freshsales name-based search.
  // Stabilize with useRef so that once companyName resolves, it doesn't revert
  // to undefined (which would cause React Query key churn and double-fetches).
  const companyNameFromStore = useStore((s) => {
    if (!domain || !s.searchResults) return undefined;
    return s.searchResults.find((c) => c.domain === domain)?.name;
  });
  const companyNameRef = useRef(companyNameFromStore);
  if (companyNameFromStore) companyNameRef.current = companyNameFromStore;
  const companyName = companyNameRef.current;

  const isRefreshRef = useRef(false);

  const companyQuery = useQuery({
    queryKey: ["company", domain, companyName],
    queryFn: () => fetchCompany(domain!, companyName),
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  const contactsQuery = useQuery({
    queryKey: ["company-contacts", domain, companyName],
    queryFn: () => {
      const refresh = isRefreshRef.current;
      isRefreshRef.current = false;
      return fetchContacts(domain!, companyName, refresh);
    },
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  const signalsQuery = useQuery({
    queryKey: ["company-signals", domain],
    queryFn: () => fetchSignals(domain!),
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  // Sync contacts to Zustand store for other consumers (export, bulk actions)
  // Also update contactCount in searchResults so company cards reflect real count
  const contactsData = contactsQuery.data;
  useEffect(() => {
    if (domain && contactsData && contactsData.length > 0) {
      const state = useStore.getState();
      state.setContactsForDomain(domain, contactsData);
      const results = state.searchResults;
      if (results) {
        const updated = results.map((c) =>
          c.domain === domain ? { ...c, contactCount: contactsData.length } : c
        );
        state.setSearchResults(updated);
      }
    }
  }, [domain, contactsData]);

  const company = companyQuery.data ?? null;
  const contacts = contactsQuery.data ?? [];

  // Override contactCount with actual contacts length once loaded
  const companyWithCount = company
    ? { ...company, contactCount: contacts.length || company.contactCount }
    : null;

  return {
    company: companyWithCount,
    contacts,
    signals: signalsQuery.data ?? [],
    isLoading: companyQuery.isLoading || contactsQuery.isLoading || signalsQuery.isLoading,
    error: companyQuery.error?.message || contactsQuery.error?.message || signalsQuery.error?.message || null,
    refetch: () => {
      isRefreshRef.current = true;
      companyQuery.refetch();
      contactsQuery.refetch();
      signalsQuery.refetch();
    },
  };
}
