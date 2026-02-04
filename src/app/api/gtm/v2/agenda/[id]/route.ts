import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { updateAgendaItem } from "@/lib/gtm/v2-queries";
import { v2AgendaUpdateSchema } from "@/lib/gtm/v2-validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = v2AgendaUpdateSchema.safeParse({ ...body, id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { id: itemId, ...updates } = parsed.data;
    const item = await updateAgendaItem(itemId, updates);
    return NextResponse.json({ item });
  } catch (err) {
    console.error("Failed to update agenda item:", err);
    return NextResponse.json(
      { error: "Failed to update agenda item" },
      { status: 500 }
    );
  }
}
