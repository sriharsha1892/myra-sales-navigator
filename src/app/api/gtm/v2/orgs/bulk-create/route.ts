import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { bulkCreateOrgs } from "@/lib/gtm/kv-orgs";
import { v2BulkCreateSchema } from "@/lib/gtm/v2-validation";

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = v2BulkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { created, skipped } = await bulkCreateOrgs(parsed.data.orgs);
    return NextResponse.json({
      created: created.length,
      skipped,
      orgs: created,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bulk create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
