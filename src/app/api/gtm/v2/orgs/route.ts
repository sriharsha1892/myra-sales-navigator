import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { getOrgs, createOrg } from "@/lib/gtm/kv-orgs";
import { v2OrgSchema, v2SegmentEnum } from "@/lib/gtm/v2-validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const rawSegment = request.nextUrl.searchParams.get("segment");
    if (rawSegment) {
      const parsed = v2SegmentEnum.safeParse(rawSegment);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid segment" },
          { status: 400 }
        );
      }
      const orgs = await getOrgs(parsed.data);
      return NextResponse.json({ orgs });
    }
    const orgs = await getOrgs();
    return NextResponse.json({ orgs });
  } catch (err) {
    console.error("Failed to fetch orgs:", err);
    return NextResponse.json(
      { error: "Failed to fetch orgs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = v2OrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const org = await createOrg(parsed.data as Parameters<typeof createOrg>[0]);
    return NextResponse.json({ org });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create org";
    const isDuplicate = msg.includes("duplicate") || msg.includes("unique");
    return NextResponse.json(
      { error: isDuplicate ? "Organization name already exists" : msg },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
