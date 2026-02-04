import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { updateOrg } from "@/lib/gtm/kv-orgs";
import { v2OrgUpdateSchema } from "@/lib/gtm/v2-validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = v2OrgUpdateSchema.safeParse({ ...body, id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { id: orgId, ...updates } = parsed.data;
    const org = await updateOrg(orgId, updates);
    return NextResponse.json({ org });
  } catch (err) {
    console.error("Failed to update org:", err);
    return NextResponse.json(
      { error: "Failed to update org" },
      { status: 500 }
    );
  }
}
