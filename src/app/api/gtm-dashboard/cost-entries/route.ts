import { NextRequest, NextResponse } from "next/server";
import { getCostEntries, addCostEntry } from "@/lib/gtm-dashboard/queries";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { costEntrySchema } from "@/lib/gtm-dashboard/validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const orgId =
      request.nextUrl.searchParams.get("organizationId") ?? undefined;
    const entries = await getCostEntries(orgId);
    return NextResponse.json({ entries });
  } catch (e) {
    console.error("[gtm-dashboard/cost-entries] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch cost entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = costEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const entry = await addCostEntry({
      ...parsed.data,
      enteredBy: parsed.data.enteredBy ?? undefined,
      notes: parsed.data.notes ?? undefined,
    });
    return NextResponse.json({ entry });
  } catch (e) {
    console.error("[gtm-dashboard/cost-entries] POST error:", e);
    return NextResponse.json(
      { error: "Failed to add cost entry" },
      { status: 500 }
    );
  }
}
