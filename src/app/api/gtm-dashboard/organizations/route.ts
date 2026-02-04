import { NextRequest, NextResponse } from "next/server";
import {
  getOrganizations,
  getOrganizationsBySegment,
  upsertOrganization,
  deleteOrganization,
} from "@/lib/gtm-dashboard/queries";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import {
  organizationSchema,
  deleteOrgSchema,
  segmentEnum,
} from "@/lib/gtm-dashboard/validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const rawSegment = request.nextUrl.searchParams.get("segment");
    if (rawSegment) {
      const parsed = segmentEnum.safeParse(rawSegment);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid segment", issues: parsed.error.issues },
          { status: 400 }
        );
      }
      const orgs = await getOrganizationsBySegment(parsed.data);
      return NextResponse.json({ organizations: orgs });
    }
    const orgs = await getOrganizations();
    return NextResponse.json({ organizations: orgs });
  } catch (e) {
    console.error("[gtm-dashboard/organizations] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = organizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const org = await upsertOrganization(parsed.data);
    return NextResponse.json({ organization: org });
  } catch (e) {
    console.error("[gtm-dashboard/organizations] POST error:", e);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = organizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    if (!parsed.data.id) {
      return NextResponse.json({ error: "ID required for update" }, { status: 400 });
    }
    const org = await upsertOrganization(parsed.data);
    return NextResponse.json({ organization: org });
  } catch (e) {
    console.error("[gtm-dashboard/organizations] PUT error:", e);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = deleteOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    await deleteOrganization(parsed.data.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[gtm-dashboard/organizations] DELETE error:", e);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}
