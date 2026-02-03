import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/gtm-dashboard/queries";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const snapshot = await getSnapshot(id);
    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ snapshot });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch snapshot" },
      { status: 500 }
    );
  }
}
