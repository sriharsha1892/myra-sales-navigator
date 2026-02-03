import { NextRequest, NextResponse } from "next/server";
import {
  getUpdates,
  createUpdate,
  updateUpdate,
} from "@/lib/gtm-dashboard/queries";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { updateSchema, updateEditSchema } from "@/lib/gtm-dashboard/validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const snapshotId =
      request.nextUrl.searchParams.get("snapshotId") ?? undefined;
    const updates = await getUpdates(snapshotId);
    return NextResponse.json({ updates });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const update = await createUpdate(
      parsed.data.content,
      parsed.data.snapshotId ?? undefined
    );
    return NextResponse.json({ update });
  } catch {
    return NextResponse.json(
      { error: "Failed to create update" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = updateEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const update = await updateUpdate(parsed.data.id, parsed.data.content);
    return NextResponse.json({ update });
  } catch {
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
