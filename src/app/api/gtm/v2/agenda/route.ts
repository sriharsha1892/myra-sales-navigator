import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import {
  getAgendaItems,
  getUnresolvedAgendaItems,
  createAgendaItem,
} from "@/lib/gtm/v2-queries";
import { v2AgendaItemSchema } from "@/lib/gtm/v2-validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const entryDate = request.nextUrl.searchParams.get("entryDate");
    const unresolvedOnly = request.nextUrl.searchParams.get("unresolved") === "true";

    if (unresolvedOnly) {
      const items = await getUnresolvedAgendaItems();
      return NextResponse.json({ items });
    }
    if (!entryDate) {
      return NextResponse.json(
        { error: "entryDate parameter required" },
        { status: 400 }
      );
    }
    const items = await getAgendaItems(entryDate);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Failed to fetch agenda items:", err);
    return NextResponse.json(
      { error: "Failed to fetch agenda items" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = v2AgendaItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const item = await createAgendaItem(parsed.data);
    return NextResponse.json({ item });
  } catch (err) {
    console.error("Failed to create agenda item:", err);
    return NextResponse.json(
      { error: "Failed to create agenda item" },
      { status: 500 }
    );
  }
}
