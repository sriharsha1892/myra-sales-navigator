"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  GtmOrganization,
  GtmSnapshot,
  GtmUpdate,
  GtmLeadGen,
  GtmCostEntry,
  RoadmapTile,
  Segment,
} from "@/lib/gtm-dashboard/types";

const Q = {
  orgs: ["gtm", "organizations"] as const,
  snapshots: ["gtm", "snapshots"] as const,
  updates: ["gtm", "updates"] as const,
  leadGen: ["gtm", "leadGen"] as const,
  costEntries: ["gtm", "costEntries"] as const,
  config: (key: string) => ["gtm", "config", key] as const,
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Organizations ---

export function useGtmOrganizations(segment?: Segment) {
  const params = segment ? `?segment=${encodeURIComponent(segment)}` : "";
  return useQuery({
    queryKey: segment ? [...Q.orgs, segment] : [...Q.orgs],
    queryFn: () =>
      api<{ organizations: GtmOrganization[] }>(
        `/api/gtm-dashboard/organizations${params}`
      ).then((r) => r.organizations),
  });
}

export function useUpsertOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      org: Partial<GtmOrganization> & { name: string; segment: Segment }
    ) =>
      api<{ organization: GtmOrganization }>(
        "/api/gtm-dashboard/organizations",
        {
          method: org.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(org),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api("/api/gtm-dashboard/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

export function useBulkImportOrganizations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      organizations: Array<
        Partial<GtmOrganization> & { name: string; segment: Segment }
      >
    ) =>
      api("/api/gtm-dashboard/organizations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizations }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

// --- Snapshots ---

export function useGtmSnapshots() {
  return useQuery({
    queryKey: [...Q.snapshots],
    queryFn: () =>
      api<{ snapshots: GtmSnapshot[] }>("/api/gtm-dashboard/snapshots").then(
        (r) => r.snapshots
      ),
  });
}

export function useGtmSnapshot(id: string | null) {
  return useQuery({
    queryKey: [...Q.snapshots, id],
    queryFn: () =>
      api<{ snapshot: GtmSnapshot }>(
        `/api/gtm-dashboard/snapshots/${id}`
      ).then((r) => r.snapshot),
    enabled: !!id,
  });
}

export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; snapshotData: unknown }) =>
      api<{ snapshot: GtmSnapshot }>("/api/gtm-dashboard/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.snapshots });
    },
  });
}

// --- Updates ---

export function useGtmUpdates(snapshotId?: string) {
  const params = snapshotId ? `?snapshotId=${snapshotId}` : "";
  return useQuery({
    queryKey: snapshotId ? [...Q.updates, snapshotId] : [...Q.updates],
    queryFn: () =>
      api<{ updates: GtmUpdate[] }>(
        `/api/gtm-dashboard/updates${params}`
      ).then((r) => r.updates),
  });
}

export function useCreateUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; snapshotId?: string }) =>
      api<{ update: GtmUpdate }>("/api/gtm-dashboard/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.updates });
    },
  });
}

export function useUpdateUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; content: string }) =>
      api<{ update: GtmUpdate }>("/api/gtm-dashboard/updates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.updates });
    },
  });
}

// --- Lead Gen ---

export function useGtmLeadGen(snapshotId?: string) {
  const params = snapshotId ? `?snapshotId=${snapshotId}` : "";
  return useQuery({
    queryKey: snapshotId ? [...Q.leadGen, snapshotId] : [...Q.leadGen],
    queryFn: () =>
      api<{ leadGen: GtmLeadGen | null }>(
        `/api/gtm-dashboard/lead-gen${params}`
      ).then((r) => r.leadGen),
  });
}

export function useUpsertLeadGen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<GtmLeadGen>) =>
      api<{ leadGen: GtmLeadGen }>("/api/gtm-dashboard/lead-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.leadGen });
    },
  });
}

// --- Cost Entries ---

export function useGtmCostEntries(orgId?: string) {
  const params = orgId ? `?organizationId=${orgId}` : "";
  return useQuery({
    queryKey: orgId ? [...Q.costEntries, orgId] : [...Q.costEntries],
    queryFn: () =>
      api<{ entries: GtmCostEntry[] }>(
        `/api/gtm-dashboard/cost-entries${params}`
      ).then((r) => r.entries),
  });
}

export function useAddCostEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      organizationId: string;
      amount: number;
      entryType: "incremental" | "absolute";
      enteredBy?: string;
      notes?: string;
    }) =>
      api<{ entry: GtmCostEntry }>("/api/gtm-dashboard/cost-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.costEntries });
      qc.invalidateQueries({ queryKey: Q.orgs });
    },
  });
}

// --- Config ---

export function useGtmConfig<T = unknown>(key: string) {
  return useQuery({
    queryKey: Q.config(key),
    queryFn: () =>
      api<{ value: T }>(
        `/api/gtm-dashboard/config?key=${encodeURIComponent(key)}`
      ).then((r) => r.value),
  });
}

export function useSetGtmConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; value: unknown }) =>
      api("/api/gtm-dashboard/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: Q.config(variables.key) });
    },
  });
}

// --- Convenience: Roadmap Tiles ---

export function useRoadmapTiles() {
  return useGtmConfig<RoadmapTile[]>("roadmap_tiles");
}
