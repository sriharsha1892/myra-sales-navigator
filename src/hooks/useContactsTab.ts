"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { pLimit } from "@/lib/utils";
import type { Contact } from "@/lib/types";

export type PersonaType = "decision_makers" | "influencers" | "operations";

export interface ContactWithMeta extends Contact {
  inferredDepartment: string | null;
  persona: PersonaType;
}

export interface PersonaGroup {
  persona: PersonaType;
  label: string;
  contacts: ContactWithMeta[];
}

// Legacy interface for backward compatibility with company grouping
interface LegacyGroup {
  domain: string;
  companyName: string;
  icpScore: number;
  contacts: Contact[];
}

interface ContactsTabState {
  isLoading: boolean;
  fetchedCount: number;
  totalCount: number;
  estimatedTotal: number;
  groupedContacts: LegacyGroup[];
  personaGroups: PersonaGroup[];
  failedDomains: Set<string>;
  retryDomain: (domain: string) => void;
}

const limit = pLimit(5);

const DECISION_MAKER_KEYWORDS = [
  "ceo", "cto", "cfo", "coo", "cmo", "cio", "cpo", "cro",
  "vp", "president", "owner", "founder", "co-founder",
  "managing director", "chief", "partner",
];

const INFLUENCER_KEYWORDS = [
  "director", "manager", "head of", "lead", "senior director",
  "group manager", "team lead",
];

const DEPARTMENTS = [
  "Sales", "Marketing", "R&D", "Engineering", "Operations",
  "Finance", "HR", "Procurement", "IT", "Legal", "Supply Chain",
  "Product", "Business Development", "Customer Success",
];

function categorizePersona(contact: Contact): { persona: PersonaType; department: string | null } {
  const titleLower = (contact.title ?? "").toLowerCase();
  const seniority = contact.seniority;

  let persona: PersonaType = "operations";

  if (seniority === "c_level" || seniority === "vp" ||
      DECISION_MAKER_KEYWORDS.some((kw) => titleLower.includes(kw))) {
    persona = "decision_makers";
  } else if (seniority === "director" || seniority === "manager" ||
      INFLUENCER_KEYWORDS.some((kw) => titleLower.includes(kw))) {
    persona = "influencers";
  }

  // Infer department from title
  let department: string | null = null;
  for (const dept of DEPARTMENTS) {
    if (titleLower.includes(dept.toLowerCase())) {
      department = dept;
      break;
    }
  }

  return { persona, department };
}

export function useContactsTab(): ContactsTabState {
  const viewMode = useStore((s) => s.viewMode);
  const searchResults = useStore((s) => s.searchResults);
  const contactsByDomain = useStore((s) => s.contactsByDomain);
  const setContactsForDomain = useStore((s) => s.setContactsForDomain);
  const contactFilters = useStore((s) => s.contactFilters);
  const filteredCompanies = useStore((s) => s.filteredCompanies);
  const exclusions = useStore((s) => s.exclusions);

  const [fetchedCount, setFetchedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [failedDomains, setFailedDomains] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const fetchedDomainsRef = useRef<Set<string>>(new Set());

  const companies = filteredCompanies();

  // Fix B: Reset fetchedDomainsRef when searchResults changes (synchronous during render)
  const prevSearchResultsRef = useRef(searchResults);
  if (prevSearchResultsRef.current !== searchResults) {
    fetchedDomainsRef.current.clear();
    prevSearchResultsRef.current = searchResults;
  }

  // Fix A: Synchronous detection of unfetched domains for correct first-render loading state
  const hasUnfetchedDomains = viewMode === "contacts" && !!searchResults && searchResults.length > 0 &&
    companies.some(c => !contactsByDomain[c.domain] && !fetchedDomainsRef.current.has(c.domain));

  // Estimated total from search results contactCount fields
  const estimatedTotal = useMemo(() => {
    if (!searchResults) return 0;
    return searchResults.reduce((sum, c) => sum + (c.contactCount || 0), 0);
  }, [searchResults]);

  // Trigger fetch when switching to contacts view
  useEffect(() => {
    if (viewMode !== "contacts" || !searchResults || searchResults.length === 0) return;

    const domains = companies.map((c) => c.domain);
    // Skip domains already fetched (cached from dossier views or previous fetches)
    const toFetch = domains.filter(
      (d) => !contactsByDomain[d] && !fetchedDomainsRef.current.has(d)
    );

    if (toFetch.length === 0) {
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setTotalCount(toFetch.length);
    setFetchedCount(0);

    let fetched = 0;

    // Build domain→name lookup for Freshsales name-based search
    const nameByDomain = new Map<string, string>();
    for (const c of companies) {
      if (c.name && c.name !== c.domain) nameByDomain.set(c.domain, c.name);
    }

    const promises = toFetch.map((domain) =>
      limit(async () => {
        if (controller.signal.aborted) return;
        try {
          const nameParam = nameByDomain.get(domain);
          const qs = nameParam ? `?name=${encodeURIComponent(nameParam)}` : "";
          const res = await fetch(
            `/api/company/${encodeURIComponent(domain)}/contacts${qs}`,
            { signal: controller.signal }
          );
          if (!res.ok) return;
          const data = await res.json();
          if (controller.signal.aborted) return;
          setContactsForDomain(domain, data.contacts ?? []);
          fetchedDomainsRef.current.add(domain);
        } catch {
          // Track failed domains so they aren't retried endlessly
          fetchedDomainsRef.current.add(domain);
          setFailedDomains((prev) => new Set(prev).add(domain));
        } finally {
          fetched++;
          if (!controller.signal.aborted) setFetchedCount(fetched);
        }
      })
    );

    Promise.all(promises).then(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });

    return () => {
      controller.abort();
    };
    // Only re-run when viewMode switches to contacts or search results change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, searchResults]);

  // Build excluded emails set
  const excludedEmails = useMemo(() => {
    const set = new Set<string>();
    for (const ex of exclusions) {
      if (ex.type === "email") set.add(ex.value.toLowerCase());
    }
    return set;
  }, [exclusions]);

  // Build grouped + filtered + sorted contacts
  const groupedContacts = useMemo(() => {
    const seniorityOrder: Record<string, number> = {
      c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
    };

    const groups: ContactsTabState["groupedContacts"] = [];

    for (const company of companies) {
      const raw = contactsByDomain[company.domain];
      if (!raw || raw.length === 0) continue;

      let contacts = [...raw];

      // Filter out excluded emails
      contacts = contacts.filter(
        (c) => !c.email || !excludedEmails.has(c.email.toLowerCase())
      );

      // Apply contact filters
      if (contactFilters.seniority.length > 0) {
        contacts = contacts.filter((c) =>
          contactFilters.seniority.includes(c.seniority)
        );
      }
      if (contactFilters.hasEmail) {
        contacts = contacts.filter((c) => !!c.email);
      }
      if (contactFilters.sources.length > 0) {
        contacts = contacts.filter((c) =>
          c.sources.some((s) => contactFilters.sources.includes(s))
        );
      }

      // Sort contacts within group
      contacts.sort((a, b) => {
        switch (contactFilters.sortBy) {
          case "seniority": {
            const sa = seniorityOrder[a.seniority] ?? 5;
            const sb = seniorityOrder[b.seniority] ?? 5;
            return sa !== sb ? sa - sb : b.emailConfidence - a.emailConfidence;
          }
          case "email_confidence":
            return b.emailConfidence - a.emailConfidence;
          case "icp_score":
            return 0; // already grouped by company
          case "last_contacted":
            // contacts without lastVerified go to end
            if (!a.lastVerified && !b.lastVerified) return 0;
            if (!a.lastVerified) return 1;
            if (!b.lastVerified) return -1;
            const ta = new Date(a.lastVerified!).getTime();
            const tb = new Date(b.lastVerified!).getTime();
            return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
          default:
            return 0;
        }
      });

      if (contacts.length > 0) {
        groups.push({
          domain: company.domain,
          companyName: company.name,
          icpScore: company.icpScore,
          contacts,
        });
      }
    }

    return groups;
  }, [companies, contactsByDomain, contactFilters, excludedEmails]);

  // Build persona groups from all contacts
  const personaGroups = useMemo((): PersonaGroup[] => {
    const allContacts: ContactWithMeta[] = [];

    for (const group of groupedContacts) {
      for (const contact of group.contacts) {
        const { persona, department } = categorizePersona(contact);
        allContacts.push({ ...contact, persona, inferredDepartment: department });
      }
    }

    const groups: Record<PersonaType, ContactWithMeta[]> = {
      decision_makers: [],
      influencers: [],
      operations: [],
    };

    for (const c of allContacts) {
      groups[c.persona].push(c);
    }

    const labels: Record<PersonaType, string> = {
      decision_makers: "Decision Makers",
      influencers: "Influencers",
      operations: "Operations",
    };

    return (["decision_makers", "influencers", "operations"] as PersonaType[])
      .filter((p) => groups[p].length > 0)
      .map((p) => ({
        persona: p,
        label: labels[p],
        contacts: groups[p],
      }));
  }, [groupedContacts]);

  const retryDomain = (domain: string) => {
    fetchedDomainsRef.current.delete(domain);
    setFailedDomains((prev) => {
      const next = new Set(prev);
      next.delete(domain);
      return next;
    });
    setIsLoading(true);
    const retryCompany = companies.find((c) => c.domain === domain);
    const retryName = retryCompany?.name && retryCompany.name !== domain ? retryCompany.name : "";
    const retryQs = retryName ? `?name=${encodeURIComponent(retryName)}` : "";
    fetch(`/api/company/${encodeURIComponent(domain)}/contacts${retryQs}`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => {
        setContactsForDomain(domain, data.contacts ?? []);
        fetchedDomainsRef.current.add(domain);
      })
      .catch(() => {
        fetchedDomainsRef.current.add(domain);
        setFailedDomains((prev) => new Set(prev).add(domain));
      })
      .finally(() => setIsLoading(false));
  };

  return {
    isLoading: isLoading || hasUnfetchedDomains,
    fetchedCount,
    totalCount,
    estimatedTotal,
    groupedContacts,
    personaGroups,
    failedDomains,
    retryDomain,
  };
}
