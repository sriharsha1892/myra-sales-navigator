import { createServerClient } from "@/lib/supabase/server";
import type {
  GtmOrganization,
  GtmSnapshot,
  GtmUpdate,
  GtmLeadGen,
  GtmCostEntry,
  Segment,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapOrg(row: any): GtmOrganization {
  return {
    id: row.id,
    name: row.name,
    segment: row.segment,
    accountManager: row.account_manager,
    leadSource: row.lead_source,
    costTotal: Number(row.cost_total),
    conversations: row.conversations,
    usersCount: row.users_count,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnapshot(row: any): GtmSnapshot {
  const raw = row.snapshot_data;
  const safeData = {
    segments: raw?.segments ?? {},
    lead_gen: raw?.lead_gen ?? {
      inbound_total: 0, inbound_active: 0, inbound_junk: 0,
      outbound_leads: 0, outbound_reached: 0, outbound_followed: 0,
      outbound_qualified: 0, apollo_contacts: 0, apollo_status: "",
    },
  };
  return {
    id: row.id,
    label: row.label,
    snapshotData: safeData,
    createdAt: row.created_at,
  };
}

function mapUpdate(row: any): GtmUpdate {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeadGen(row: any): GtmLeadGen {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    inboundTotal: row.inbound_total,
    inboundActive: row.inbound_active,
    inboundJunk: row.inbound_junk,
    outboundLeads: row.outbound_leads,
    outboundReached: row.outbound_reached,
    outboundFollowed: row.outbound_followed,
    outboundQualified: row.outbound_qualified,
    apolloContacts: row.apollo_contacts,
    apolloStatus: row.apollo_status,
    createdAt: row.created_at,
  };
}

function mapCostEntry(row: any): GtmCostEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    amount: Number(row.amount),
    entryType: row.entry_type,
    enteredBy: row.entered_by,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Organizations ---

export async function getOrganizations(): Promise<GtmOrganization[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_organizations")
    .select("*")
    .order("segment")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapOrg);
}

export async function getOrganizationsBySegment(
  segment: Segment
): Promise<GtmOrganization[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_organizations")
    .select("*")
    .eq("segment", segment)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(mapOrg);
}

export async function getOrganization(
  id: string
): Promise<GtmOrganization | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_organizations")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return mapOrg(data);
}

export async function upsertOrganization(
  org: Partial<GtmOrganization> & { name: string; segment: Segment }
): Promise<GtmOrganization> {
  const sb = createServerClient();
  const row: Record<string, unknown> = {
    name: org.name,
    segment: org.segment,
    account_manager: org.accountManager ?? null,
    lead_source: org.leadSource ?? null,
    cost_total: org.costTotal ?? 0,
    conversations: org.conversations ?? 0,
    users_count: org.usersCount ?? 0,
    notes: org.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (org.id) row.id = org.id;

  const { data, error } = await sb
    .from("gtm_organizations")
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return mapOrg(data);
}

export async function deleteOrganization(id: string): Promise<void> {
  const sb = createServerClient();
  const { error } = await sb.from("gtm_organizations").delete().eq("id", id);
  if (error) throw error;
}

// --- Snapshots ---

export async function getSnapshots(): Promise<GtmSnapshot[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_snapshots")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSnapshot);
}

export async function getSnapshot(id: string): Promise<GtmSnapshot | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_snapshots")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return mapSnapshot(data);
}

export async function createSnapshot(
  label: string,
  snapshotData: unknown
): Promise<GtmSnapshot> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_snapshots")
    .insert({ label, snapshot_data: snapshotData })
    .select()
    .single();
  if (error) throw error;
  return mapSnapshot(data);
}

// --- Updates ---

export async function getUpdates(snapshotId?: string): Promise<GtmUpdate[]> {
  const sb = createServerClient();
  let q = sb
    .from("gtm_updates")
    .select("*")
    .order("created_at", { ascending: false });
  if (snapshotId) q = q.eq("snapshot_id", snapshotId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapUpdate);
}

export async function createUpdate(
  content: string,
  snapshotId?: string
): Promise<GtmUpdate> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_updates")
    .insert({ content, snapshot_id: snapshotId ?? null })
    .select()
    .single();
  if (error) throw error;
  return mapUpdate(data);
}

export async function updateUpdate(
  id: string,
  content: string
): Promise<GtmUpdate> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_updates")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapUpdate(data);
}

// --- Lead Gen ---

export async function getLeadGen(
  snapshotId?: string
): Promise<GtmLeadGen | null> {
  const sb = createServerClient();
  let q = sb
    .from("gtm_lead_gen")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (snapshotId) q = q.eq("snapshot_id", snapshotId);
  const { data, error } = await q.single();
  if (error) return null;
  return mapLeadGen(data);
}

export async function upsertLeadGen(
  leadGen: Partial<GtmLeadGen>
): Promise<GtmLeadGen> {
  const sb = createServerClient();
  const row: Record<string, unknown> = {
    inbound_total: leadGen.inboundTotal ?? 0,
    inbound_active: leadGen.inboundActive ?? 0,
    inbound_junk: leadGen.inboundJunk ?? 0,
    outbound_leads: leadGen.outboundLeads ?? 0,
    outbound_reached: leadGen.outboundReached ?? 0,
    outbound_followed: leadGen.outboundFollowed ?? 0,
    outbound_qualified: leadGen.outboundQualified ?? 0,
    apollo_contacts: leadGen.apolloContacts ?? 0,
    apollo_status: leadGen.apolloStatus ?? null,
    snapshot_id: leadGen.snapshotId ?? null,
  };
  if (leadGen.id) row.id = leadGen.id;

  const { data, error } = await sb
    .from("gtm_lead_gen")
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return mapLeadGen(data);
}

// --- Cost Entries ---

export async function getCostEntries(
  orgId?: string
): Promise<GtmCostEntry[]> {
  const sb = createServerClient();
  let q = sb
    .from("gtm_cost_entries")
    .select("*")
    .order("created_at", { ascending: false });
  if (orgId) q = q.eq("organization_id", orgId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapCostEntry);
}

export async function addCostEntry(entry: {
  organizationId: string;
  amount: number;
  entryType: "incremental" | "absolute";
  enteredBy?: string;
  notes?: string;
}): Promise<GtmCostEntry> {
  const sb = createServerClient();

  // Insert cost entry
  const { data, error } = await sb
    .from("gtm_cost_entries")
    .insert({
      organization_id: entry.organizationId,
      amount: entry.amount,
      entry_type: entry.entryType,
      entered_by: entry.enteredBy ?? null,
      notes: entry.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Update org cost_total — use atomic operations to avoid race conditions
  if (entry.entryType === "absolute") {
    await sb
      .from("gtm_organizations")
      .update({
        cost_total: entry.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.organizationId);
  } else {
    // Atomic increment via Postgres function — no read-then-write race
    await sb.rpc("gtm_increment_cost", {
      org_id: entry.organizationId,
      inc_amount: entry.amount,
    });
  }

  return mapCostEntry(data);
}

// --- Config ---

export async function getConfig(key: string): Promise<unknown> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_config")
    .select("value")
    .eq("key", key)
    .single();
  if (error) return null;
  return data.value;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const sb = createServerClient();
  const { error } = await sb
    .from("gtm_config")
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key);
  if (error) throw error;
}
