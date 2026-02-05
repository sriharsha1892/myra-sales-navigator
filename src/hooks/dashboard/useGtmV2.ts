"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  GtmOrg,
  GtmEntry,
  GtmAgendaItem,
  GtmV2Segment,
  OrgSnapshot,
  AmPerformanceReport,
  AmPerformanceRow,
} from "@/lib/gtm/v2-types";

const Q = {
  orgs: ["gtm-v2", "orgs"] as const,
  entries: ["gtm-v2", "entries"] as const,
  agenda: (date: string) => ["gtm-v2", "agenda", date] as const,
  unresolved: ["gtm-v2", "agenda", "unresolved"] as const,
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }
  return res.json();
}

// --- Orgs ---

export function useV2Orgs(segment?: GtmV2Segment) {
  const params = segment ? `?segment=${encodeURIComponent(segment)}` : "";
  return useQuery({
    queryKey: segment ? [...Q.orgs, segment] : [...Q.orgs],
    queryFn: () =>
      api<{ orgs: GtmOrg[] }>(`/api/gtm/v2/orgs${params}`).then((r) => r.orgs),
    staleTime: 5 * 60_000,
  });
}

export function useCreateV2Org() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (org: Partial<GtmOrg> & { name: string; segment: GtmV2Segment }) =>
      api<{ org: GtmOrg }>("/api/gtm/v2/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(org),
      }).then((r) => r.org),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

export function useUpdateV2Org() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<GtmOrg> & { id: string }) =>
      api<{ org: GtmOrg }>(`/api/gtm/v2/orgs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).then((r) => r.org),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

export function useBulkUpdateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; segment: GtmV2Segment }) =>
      api("/api/gtm/v2/orgs/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

export function useBatchUpdateOrgs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; [key: string]: unknown }[]) =>
      api<{ success: boolean; count: number }>("/api/gtm/v2/orgs/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

export function useBulkCreateV2Orgs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orgs: { name: string; segment: GtmV2Segment; accountManager?: string | null; domain?: string | null }[];
    }) =>
      api<{ created: number; skipped: string[] }>("/api/gtm/v2/orgs/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

// --- Entries ---

export function useEntryDates(enabled = true) {
  return useQuery({
    queryKey: [...Q.entries, "dates"],
    queryFn: () =>
      api<{ dates: string[] }>("/api/gtm/v2/entries?list=dates").then(
        (r) => r.dates
      ),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useV2Entries(enabled = true) {
  return useQuery({
    queryKey: [...Q.entries],
    queryFn: () =>
      api<{ latest: GtmEntry | null; previous: GtmEntry | null }>(
        "/api/gtm/v2/entries"
      ),
    staleTime: 2 * 60_000,
    enabled,
  });
}

export function useV2EntryByDate(date: string | null) {
  return useQuery({
    queryKey: date ? [...Q.entries, date] : [...Q.entries],
    queryFn: () =>
      date
        ? api<{ entry: GtmEntry | null }>(
            `/api/gtm/v2/entries?date=${encodeURIComponent(date)}`
          ).then((r) => r.entry)
        : api<{ latest: GtmEntry | null; previous: GtmEntry | null }>(
            "/api/gtm/v2/entries"
          ).then((r) => r.latest),
    enabled: !!date,
    staleTime: 2 * 60_000,
  });
}

export function useSaveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      data: {
        entryDate: string;
        createdBy?: string;
        inboundTotal?: number;
        inboundActive?: number;
        inboundJunk?: number;
        outboundLeads?: number;
        outboundReached?: number;
        outboundFollowed?: number;
        outboundQualified?: number;
        apolloContacts?: number;
        apolloNote?: string;
        totalCostUsd?: number;
        costPeriod?: string;
        amDemos?: Record<string, number>;
        orgSnapshot?: OrgSnapshot;
      }
    ) =>
      api<{ entry: GtmEntry }>("/api/gtm/v2/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.entries });
    },
  });
}

// --- Agenda ---

export function useAgendaItems(entryDate: string) {
  return useQuery({
    queryKey: Q.agenda(entryDate),
    queryFn: () =>
      api<{ items: GtmAgendaItem[] }>(
        `/api/gtm/v2/agenda?entryDate=${entryDate}`
      ).then((r) => r.items),
    enabled: !!entryDate,
    staleTime: 60_000,
  });
}

export function useUnresolvedAgenda(enabled = true) {
  return useQuery({
    queryKey: Q.unresolved,
    queryFn: () =>
      api<{ items: GtmAgendaItem[] }>(
        "/api/gtm/v2/agenda?unresolved=true"
      ).then((r) => r.items),
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      entryDate: string;
      section: string;
      content: string;
      sortOrder?: number;
      createdBy?: string;
    }) =>
      api<{ item: GtmAgendaItem }>("/api/gtm/v2/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.item),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: Q.agenda(variables.entryDate) });
      qc.invalidateQueries({ queryKey: Q.unresolved });
    },
  });
}

export function useUpdateAgendaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string;
      isResolved?: boolean;
      sortOrder?: number;
      content?: string;
    }) =>
      api<{ item: GtmAgendaItem }>(`/api/gtm/v2/agenda/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).then((r) => r.item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gtm-v2", "agenda"] });
    },
  });
}

// --- Entries (multi-date) ---

export function useEntriesByDates(dates: string[], enabled = true) {
  return useQuery({
    queryKey: [...Q.entries, "multi", ...dates],
    queryFn: () =>
      api<{ entries: GtmEntry[] }>(
        `/api/gtm/v2/entries?dates=${dates.join(",")}`
      ).then((r) => r.entries),
    enabled: enabled && dates.length > 0,
    staleTime: 2 * 60_000,
  });
}

// --- AM Performance ---

const QAM = ["gtm-v2", "am-performance"] as const;

export function useAmPerformanceReports(enabled = true) {
  return useQuery({
    queryKey: [...QAM],
    queryFn: () =>
      api<{ reports: AmPerformanceReport[] }>(
        "/api/gtm/v2/am-performance"
      ).then((r) => r.reports),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useLatestAmPerformance(enabled = true) {
  return useQuery({
    queryKey: [...QAM, "latest"],
    queryFn: () =>
      api<{ report: AmPerformanceReport | null }>(
        "/api/gtm/v2/am-performance?latest=true"
      ).then((r) => r.report),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useAmPerformanceById(id: string | null) {
  return useQuery({
    queryKey: id ? [...QAM, id] : [...QAM],
    queryFn: () =>
      api<{ report: AmPerformanceReport | null }>(
        `/api/gtm/v2/am-performance?id=${id}`
      ).then((r) => r.report),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useSaveAmPerformance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id?: string;
      periodStart: string;
      periodEnd: string;
      amData: AmPerformanceRow[];
    }) =>
      api<{ report: AmPerformanceReport }>("/api/gtm/v2/am-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.report),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QAM] });
    },
  });
}
