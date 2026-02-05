import { createServerClient } from "@/lib/supabase/server";
import { getOrgs } from "./kv-orgs";
import type {
  GtmOrg,
  GtmEntry,
  GtmAgendaItem,
  GtmV2Segment,
  OrgSnapshot,
  AmPerformanceReport,
  AmPerformanceRow,
} from "./v2-types";
import { buildOrgSnapshot } from "./v2-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = Record<string, any>;

function mapOrg(row: SupabaseRow): GtmOrg {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    segment: row.segment,
    accountManager: row.account_manager,
    tags: row.tags ?? [],
    notes: row.notes,
    costUsd: Number(row.cost_usd ?? 0),
    conversations: row.conversations ?? 0,
    users: row.users ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEntry(row: SupabaseRow): GtmEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    createdBy: row.created_by,
    inboundTotal: row.inbound_total ?? 0,
    inboundActive: row.inbound_active ?? 0,
    inboundJunk: row.inbound_junk ?? 0,
    outboundLeads: row.outbound_leads ?? 0,
    outboundReached: row.outbound_reached ?? 0,
    outboundFollowed: row.outbound_followed ?? 0,
    outboundQualified: row.outbound_qualified ?? 0,
    apolloContacts: row.apollo_contacts ?? 0,
    apolloNote: row.apollo_note,
    totalCostUsd: Number(row.total_cost_usd ?? 0),
    costPeriod: row.cost_period,
    amDemos: row.am_demos ?? {},
    orgSnapshot: row.org_snapshot ?? { counts: {}, names: {}, totalCost: 0, totalUsers: 0, totalConversations: 0 },
    createdAt: row.created_at,
  };
}

function mapAgendaItem(row: SupabaseRow): GtmAgendaItem {
  return {
    id: row.id,
    entryDate: row.entry_date,
    section: row.section,
    content: row.content,
    sortOrder: row.sort_order ?? 0,
    isResolved: row.is_resolved ?? false,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}


// --- Orgs ---

export async function getV2Orgs(segment?: GtmV2Segment): Promise<GtmOrg[]> {
  const sb = createServerClient();
  let q = sb.from("gtm_orgs").select("*").order("segment").order("name");
  if (segment) q = q.eq("segment", segment);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapOrg);
}

export async function createV2Org(
  org: { name: string; segment: GtmV2Segment } & Partial<GtmOrg>
): Promise<GtmOrg> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_orgs")
    .insert({
      name: org.name,
      domain: org.domain ?? null,
      segment: org.segment,
      account_manager: org.accountManager ?? null,
      tags: org.tags ?? [],
      notes: org.notes ?? null,
      cost_usd: org.costUsd ?? 0,
      conversations: org.conversations ?? 0,
      users: org.users ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return mapOrg(data);
}

export async function updateV2Org(
  id: string,
  updates: Partial<GtmOrg>
): Promise<GtmOrg> {
  const sb = createServerClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.domain !== undefined) row.domain = updates.domain;
  if (updates.segment !== undefined) row.segment = updates.segment;
  if (updates.accountManager !== undefined) row.account_manager = updates.accountManager;
  if (updates.tags !== undefined) row.tags = updates.tags;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.costUsd !== undefined) row.cost_usd = updates.costUsd;
  if (updates.conversations !== undefined) row.conversations = updates.conversations;
  if (updates.users !== undefined) row.users = updates.users;

  const { data, error } = await sb
    .from("gtm_orgs")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapOrg(data);
}

export async function bulkUpdateSegment(
  ids: string[],
  segment: GtmV2Segment
): Promise<void> {
  const sb = createServerClient();
  const { error } = await sb
    .from("gtm_orgs")
    .update({ segment, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function batchUpdateOrgs(
  updates: { id: string; [key: string]: unknown }[]
): Promise<void> {
  const sb = createServerClient();
  const now = new Date().toISOString();

  for (const { id, ...fields } of updates) {
    const row: Record<string, unknown> = { updated_at: now };
    if (fields.name !== undefined) row.name = fields.name;
    if (fields.domain !== undefined) row.domain = fields.domain;
    if (fields.segment !== undefined) row.segment = fields.segment;
    if (fields.accountManager !== undefined) row.account_manager = fields.accountManager;
    if (fields.tags !== undefined) row.tags = fields.tags;
    if (fields.notes !== undefined) row.notes = fields.notes;
    if (fields.costUsd !== undefined) row.cost_usd = fields.costUsd;
    if (fields.conversations !== undefined) row.conversations = fields.conversations;
    if (fields.users !== undefined) row.users = fields.users;

    const { error } = await sb.from("gtm_orgs").update(row).eq("id", id);
    if (error) throw error;
  }
}

export async function bulkCreateV2Orgs(
  orgs: { name: string; segment: GtmV2Segment; accountManager?: string | null; domain?: string | null }[]
): Promise<{ created: GtmOrg[]; skipped: string[] }> {
  const sb = createServerClient();

  // Check for existing orgs by name (case-insensitive)
  const names = orgs.map((o) => o.name.trim());
  const { data: existing } = await sb
    .from("gtm_orgs")
    .select("name")
    .in("name", names);
  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name.toLowerCase()));

  const toInsert = orgs.filter((o) => !existingNames.has(o.name.trim().toLowerCase()));
  const skipped = orgs
    .filter((o) => existingNames.has(o.name.trim().toLowerCase()))
    .map((o) => o.name);

  if (toInsert.length === 0) {
    return { created: [], skipped };
  }

  const rows = toInsert.map((o) => ({
    name: o.name.trim(),
    domain: o.domain ?? null,
    segment: o.segment,
    account_manager: o.accountManager ?? null,
    tags: [],
    notes: null,
    cost_usd: 0,
    conversations: 0,
    users: 0,
  }));

  const { data, error } = await sb.from("gtm_orgs").insert(rows).select();
  if (error) throw error;
  return { created: (data ?? []).map(mapOrg), skipped };
}

// --- Entries ---

export async function getLatestEntries(
  limit: number = 2
): Promise<GtmEntry[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

export async function getEntryByDate(
  date: string
): Promise<GtmEntry | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_entries")
    .select("*")
    .eq("entry_date", date)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEntry(data) : null;
}

export async function upsertEntry(
  entry: {
    entryDate: string;
    createdBy?: string | null;
    inboundTotal?: number;
    inboundActive?: number;
    inboundJunk?: number;
    outboundLeads?: number;
    outboundReached?: number;
    outboundFollowed?: number;
    outboundQualified?: number;
    apolloContacts?: number;
    apolloNote?: string | null;
    totalCostUsd?: number;
    costPeriod?: string | null;
    amDemos?: Record<string, number>;
    orgSnapshot?: OrgSnapshot;
  }
): Promise<GtmEntry> {
  const sb = createServerClient();

  // Use client-provided snapshot if available, otherwise fall back to KV-based auto-snapshot
  let snapshot: OrgSnapshot;
  if (entry.orgSnapshot) {
    snapshot = entry.orgSnapshot;
  } else {
    const orgs = await getOrgs();
    snapshot = buildOrgSnapshot(orgs);
  }

  const row = {
    entry_date: entry.entryDate,
    created_by: entry.createdBy ?? null,
    inbound_total: entry.inboundTotal ?? 0,
    inbound_active: entry.inboundActive ?? 0,
    inbound_junk: entry.inboundJunk ?? 0,
    outbound_leads: entry.outboundLeads ?? 0,
    outbound_reached: entry.outboundReached ?? 0,
    outbound_followed: entry.outboundFollowed ?? 0,
    outbound_qualified: entry.outboundQualified ?? 0,
    apollo_contacts: entry.apolloContacts ?? 0,
    apollo_note: entry.apolloNote ?? null,
    total_cost_usd: entry.totalCostUsd ?? snapshot.totalCost ?? 0,
    cost_period: entry.costPeriod ?? null,
    am_demos: entry.amDemos ?? {},
    org_snapshot: snapshot,
  };

  const { data, error } = await sb
    .from("gtm_entries")
    .upsert(row, { onConflict: "entry_date" })
    .select()
    .single();
  if (error) throw error;
  return mapEntry(data);
}

/** Return all distinct entry_date values, descending */
export async function getEntryDates(): Promise<string[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_entries")
    .select("entry_date")
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: { entry_date: string }) => r.entry_date);
}

// --- Agenda ---

export async function getAgendaItems(
  entryDate: string
): Promise<GtmAgendaItem[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_agenda_items")
    .select("*")
    .eq("entry_date", entryDate)
    .order("section")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(mapAgendaItem);
}

export async function getUnresolvedAgendaItems(): Promise<GtmAgendaItem[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_agenda_items")
    .select("*")
    .eq("is_resolved", false)
    .order("entry_date", { ascending: false })
    .order("section")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(mapAgendaItem);
}

export async function createAgendaItem(item: {
  entryDate: string;
  section: string;
  content: string;
  sortOrder?: number;
  createdBy?: string | null;
}): Promise<GtmAgendaItem> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_agenda_items")
    .insert({
      entry_date: item.entryDate,
      section: item.section,
      content: item.content,
      sort_order: item.sortOrder ?? 0,
      created_by: item.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapAgendaItem(data);
}

export async function updateAgendaItem(
  id: string,
  updates: { isResolved?: boolean; sortOrder?: number; content?: string }
): Promise<GtmAgendaItem> {
  const sb = createServerClient();
  const row: Record<string, unknown> = {};
  if (updates.isResolved !== undefined) row.is_resolved = updates.isResolved;
  if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
  if (updates.content !== undefined) row.content = updates.content;

  const { data, error } = await sb
    .from("gtm_agenda_items")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapAgendaItem(data);
}

// --- Entries (multi-date) ---

/** Fetch multiple entries by specific dates */
export async function getEntriesByDates(
  dates: string[]
): Promise<GtmEntry[]> {
  if (dates.length === 0) return [];
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_entries")
    .select("*")
    .in("entry_date", dates)
    .order("entry_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

// --- AM Performance ---

function mapAmPerformance(row: SupabaseRow): AmPerformanceReport {
  return {
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amData: (row.am_data as AmPerformanceRow[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAmPerformanceReports(): Promise<AmPerformanceReport[]> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_am_performance")
    .select("*")
    .order("period_end", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAmPerformance);
}

export async function getAmPerformanceById(
  id: string
): Promise<AmPerformanceReport | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_am_performance")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAmPerformance(data) : null;
}

/** Get the latest AM performance report */
export async function getLatestAmPerformance(): Promise<AmPerformanceReport | null> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("gtm_am_performance")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAmPerformance(data) : null;
}

export async function upsertAmPerformance(
  report: {
    id?: string;
    periodStart: string;
    periodEnd: string;
    amData: AmPerformanceRow[];
  }
): Promise<AmPerformanceReport> {
  const sb = createServerClient();
  const row = {
    period_start: report.periodStart,
    period_end: report.periodEnd,
    am_data: report.amData,
    updated_at: new Date().toISOString(),
  };

  if (report.id) {
    const { data, error } = await sb
      .from("gtm_am_performance")
      .update(row)
      .eq("id", report.id)
      .select()
      .single();
    if (error) throw error;
    return mapAmPerformance(data);
  }

  const { data, error } = await sb
    .from("gtm_am_performance")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return mapAmPerformance(data);
}
