import { NextRequest, NextResponse } from "next/server";
import { getLeadGen, upsertLeadGen } from "@/lib/gtm-dashboard/queries";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { leadGenSchema } from "@/lib/gtm-dashboard/validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const snapshotId =
      request.nextUrl.searchParams.get("snapshotId") ?? undefined;
    const leadGen = await getLeadGen(snapshotId);
    return NextResponse.json({ leadGen });
  } catch (e) {
    console.error("[gtm-dashboard/lead-gen] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch lead gen" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = leadGenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const leadGen = await upsertLeadGen(parsed.data);
    return NextResponse.json({ leadGen });
  } catch (e) {
    console.error("[gtm-dashboard/lead-gen] POST error:", e);
    return NextResponse.json(
      { error: "Failed to update lead gen" },
      { status: 500 }
    );
  }
}
