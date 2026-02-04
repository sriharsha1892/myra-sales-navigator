import { randomUUID } from "crypto";
import { kv } from "@/lib/kv";
import type { GtmOrg, GtmV2Segment } from "./v2-types";

const KV_KEY = "gtm:orgs";

async function readOrgs(): Promise<GtmOrg[]> {
  const data = await kv.get<GtmOrg[]>(KV_KEY);
  return data ?? [];
}

async function writeOrgs(orgs: GtmOrg[]): Promise<void> {
  await kv.set(KV_KEY, orgs);
}

export async function getOrgs(segment?: GtmV2Segment): Promise<GtmOrg[]> {
  const orgs = await readOrgs();
  const filtered = segment ? orgs.filter((o) => o.segment === segment) : orgs;
  return filtered.sort((a, b) => {
    if (a.segment !== b.segment) return a.segment.localeCompare(b.segment);
    return a.name.localeCompare(b.name);
  });
}

export async function createOrg(
  org: { name: string; segment: GtmV2Segment } & Partial<GtmOrg>
): Promise<GtmOrg> {
  const orgs = await readOrgs();

  // Check duplicate by name (case-insensitive)
  const nameLower = org.name.trim().toLowerCase();
  if (orgs.some((o) => o.name.toLowerCase() === nameLower)) {
    throw new Error("duplicate: Organization name already exists");
  }

  const now = new Date().toISOString();
  const newOrg: GtmOrg = {
    id: randomUUID(),
    name: org.name.trim(),
    domain: org.domain ?? null,
    segment: org.segment,
    accountManager: org.accountManager ?? null,
    tags: org.tags ?? [],
    notes: org.notes ?? null,
    costUsd: org.costUsd ?? 0,
    conversations: org.conversations ?? 0,
    users: org.users ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  orgs.push(newOrg);
  await writeOrgs(orgs);
  return newOrg;
}

export async function updateOrg(
  id: string,
  updates: Partial<GtmOrg>
): Promise<GtmOrg> {
  const orgs = await readOrgs();
  const idx = orgs.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error("Org not found");

  const updated: GtmOrg = {
    ...orgs[idx],
    ...updates,
    id: orgs[idx].id, // preserve id
    updatedAt: new Date().toISOString(),
  };
  orgs[idx] = updated;
  await writeOrgs(orgs);
  return updated;
}

export async function bulkUpdateSegment(
  ids: string[],
  segment: GtmV2Segment
): Promise<void> {
  const orgs = await readOrgs();
  const idSet = new Set(ids);
  const now = new Date().toISOString();

  for (const org of orgs) {
    if (idSet.has(org.id)) {
      org.segment = segment;
      org.updatedAt = now;
    }
  }
  await writeOrgs(orgs);
}

export async function batchUpdateOrgs(
  updates: { id: string; [key: string]: unknown }[]
): Promise<void> {
  const orgs = await readOrgs();
  const updateMap = new Map(updates.map((u) => [u.id, u]));
  const now = new Date().toISOString();

  for (const org of orgs) {
    const u = updateMap.get(org.id);
    if (!u) continue;

    if (u.name !== undefined) org.name = u.name as string;
    if (u.domain !== undefined) org.domain = u.domain as string | null;
    if (u.segment !== undefined) org.segment = u.segment as GtmV2Segment;
    if (u.accountManager !== undefined) org.accountManager = u.accountManager as string | null;
    if (u.tags !== undefined) org.tags = u.tags as string[];
    if (u.notes !== undefined) org.notes = u.notes as string | null;
    if (u.costUsd !== undefined) org.costUsd = u.costUsd as number;
    if (u.conversations !== undefined) org.conversations = u.conversations as number;
    if (u.users !== undefined) org.users = u.users as number;
    org.updatedAt = now;
  }
  await writeOrgs(orgs);
}

export async function bulkCreateOrgs(
  orgs: { name: string; segment: GtmV2Segment; accountManager?: string | null; domain?: string | null }[]
): Promise<{ created: GtmOrg[]; skipped: string[] }> {
  const existing = await readOrgs();
  const existingNames = new Set(existing.map((o) => o.name.toLowerCase()));

  const toInsert = orgs.filter((o) => !existingNames.has(o.name.trim().toLowerCase()));
  const skipped = orgs
    .filter((o) => existingNames.has(o.name.trim().toLowerCase()))
    .map((o) => o.name);

  if (toInsert.length === 0) {
    return { created: [], skipped };
  }

  const now = new Date().toISOString();
  const created: GtmOrg[] = toInsert.map((o) => ({
    id: randomUUID(),
    name: o.name.trim(),
    domain: o.domain ?? null,
    segment: o.segment,
    accountManager: o.accountManager ?? null,
    tags: [],
    notes: null,
    costUsd: 0,
    conversations: 0,
    users: 0,
    createdAt: now,
    updatedAt: now,
  }));

  existing.push(...created);
  await writeOrgs(existing);
  return { created, skipped };
}
