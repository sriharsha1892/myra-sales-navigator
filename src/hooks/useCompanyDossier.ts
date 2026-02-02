"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompanyEnriched, Contact, Signal } from "@/lib/types";

async function fetchCompany(domain: string): Promise<CompanyEnriched> {
  const res = await fetch(`/api/company/${encodeURIComponent(domain)}`);
  if (!res.ok) throw new Error("Failed to load company");
  const data = await res.json();

  // The API returns { company, sources: { apollo, hubspot }, aiSummary }.
  // Merge into a single CompanyEnriched, ensuring sources stays an array.
  const company = data.company ?? {};
  const sourcesArr: string[] = Array.isArray(company.sources) ? company.sources : [];
  if (data.sources?.apollo && !sourcesArr.includes("apollo")) sourcesArr.push("apollo");
  if (data.sources?.hubspot && !sourcesArr.includes("hubspot")) sourcesArr.push("hubspot");

  const now = new Date().toISOString();

  return {
    // Anchor field defaults
    domain: company.domain ?? domain,
    name: company.name || domain,
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

    // Enrichment field defaults
    industry: company.industry ?? "",
    vertical: company.vertical ?? "",
    employeeCount: company.employeeCount ?? 0,
    location: company.location ?? "",
    region: company.region ?? "",
    description: company.description ?? "",
    icpScore: company.icpScore ?? 0,
    hubspotStatus: company.hubspotStatus ?? data.hubspotStatus?.status ?? "none",
    sources: sourcesArr,
    signals: Array.isArray(company.signals) ? company.signals : [],
    contactCount: company.contactCount ?? 0,
    lastRefreshed: company.lastRefreshed ?? now,

    // Optional fields — pass through if present
    logoUrl: company.logoUrl,
    revenue: company.revenue,
    founded: company.founded,
    website: company.website,
    phone: company.phone,
    aiSummary: data.aiSummary ?? company.aiSummary,
  } as CompanyEnriched;
}

async function fetchContacts(domain: string): Promise<Contact[]> {
  const res = await fetch(`/api/company/${encodeURIComponent(domain)}/contacts`);
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
  const companyQuery = useQuery({
    queryKey: ["company", domain],
    queryFn: () => fetchCompany(domain!),
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  const contactsQuery = useQuery({
    queryKey: ["company-contacts", domain],
    queryFn: () => fetchContacts(domain!),
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  const signalsQuery = useQuery({
    queryKey: ["company-signals", domain],
    queryFn: () => fetchSignals(domain!),
    enabled: !!domain,
    staleTime: 5 * 60 * 1000,
  });

  return {
    company: companyQuery.data ?? null,
    contacts: contactsQuery.data ?? [],
    signals: signalsQuery.data ?? [],
    isLoading: companyQuery.isLoading || contactsQuery.isLoading || signalsQuery.isLoading,
    error: companyQuery.error?.message || contactsQuery.error?.message || signalsQuery.error?.message || null,
    refetch: () => {
      companyQuery.refetch();
      contactsQuery.refetch();
      signalsQuery.refetch();
    },
  };
}
