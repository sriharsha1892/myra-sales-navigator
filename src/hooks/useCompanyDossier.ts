"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompanyEnriched, Contact, Signal } from "@/lib/types";

async function fetchCompany(domain: string): Promise<CompanyEnriched> {
  const res = await fetch(`/api/company/${encodeURIComponent(domain)}`);
  if (!res.ok) throw new Error("Failed to load company");
  return res.json();
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
