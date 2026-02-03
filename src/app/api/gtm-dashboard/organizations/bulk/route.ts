import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { bulkOrgsSchema } from "@/lib/gtm-dashboard/validation";

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = bulkOrgsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const sb = createServerClient();
    const rows = parsed.data.organizations.map((org) => ({
      name: org.name,
      segment: org.segment,
      account_manager: org.accountManager ?? null,
      lead_source: org.leadSource ?? null,
      cost_total: org.costTotal ?? 0,
      conversations: org.conversations ?? 0,
      users_count: org.usersCount ?? 0,
      notes: org.notes ?? null,
    }));

    const { data, error } = await sb
      .from("gtm_organizations")
      .insert(rows)
      .select();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: data?.length ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to bulk import organizations" },
      { status: 500 }
    );
  }
}
