import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import { getLatestEntries, getEntryByDate, getEntryDates, upsertEntry } from "@/lib/gtm/v2-queries";
import { v2EntrySchema } from "@/lib/gtm/v2-validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const list = request.nextUrl.searchParams.get("list");
    if (list === "dates") {
      const dates = await getEntryDates();
      return NextResponse.json({ dates });
    }

    const date = request.nextUrl.searchParams.get("date");
    if (date) {
      const entry = await getEntryByDate(date);
      return NextResponse.json({ entry });
    }

    const entries = await getLatestEntries(2);
    return NextResponse.json({
      latest: entries[0] ?? null,
      previous: entries[1] ?? null,
    });
  } catch (err) {
    console.error("Failed to fetch entries:", err);
    return NextResponse.json(
      { error: "Failed to fetch entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = v2EntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const entry = await upsertEntry(parsed.data);
    return NextResponse.json({ entry });
  } catch (err) {
    console.error("Failed to save entry:", err);
    return NextResponse.json(
      { error: "Failed to save entry" },
      { status: 500 }
    );
  }
}
