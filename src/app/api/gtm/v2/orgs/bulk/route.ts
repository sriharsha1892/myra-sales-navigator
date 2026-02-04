import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { bulkUpdateSegment } from "@/lib/gtm/kv-orgs";
import { v2BulkSegmentSchema } from "@/lib/gtm/v2-validation";

export async function PUT(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = v2BulkSegmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    await bulkUpdateSegment(parsed.data.ids, parsed.data.segment);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to bulk update:", err);
    return NextResponse.json(
      { error: "Failed to bulk update" },
      { status: 500 }
    );
  }
}
