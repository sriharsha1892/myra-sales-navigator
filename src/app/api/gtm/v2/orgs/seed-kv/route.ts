import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { createServerClient } from "@/lib/supabase/server";
import { kv } from "@/lib/kv";
import type { GtmOrg } from "@/lib/gtm/v2-types";

const KV_KEY = "gtm:orgs";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapOrg(row: any): GtmOrg {
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
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const sb = createServerClient();
    const { data, error } = await sb
      .from("gtm_orgs")
      .select("*")
      .order("segment")
      .order("name");

    if (error) throw error;

    const orgs = (data ?? []).map(mapOrg);
    await kv.set(KV_KEY, orgs);

    return NextResponse.json({
      success: true,
      count: orgs.length,
      message: `Seeded ${orgs.length} orgs from Supabase to KV`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Seed failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
