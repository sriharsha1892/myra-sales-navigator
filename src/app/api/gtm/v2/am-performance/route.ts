import { NextRequest, NextResponse } from "next/server";
import { requireGtmAuth } from "@/lib/gtm-dashboard/route-auth";
import {
  getAmPerformanceReports,
  getAmPerformanceById,
  getLatestAmPerformance,
  upsertAmPerformance,
} from "@/lib/gtm/v2-queries";
import { v2AmPerformanceSchema } from "@/lib/gtm/v2-validation";

export async function GET(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const report = await getAmPerformanceById(id);
      return NextResponse.json({ report });
    }

    const latest = request.nextUrl.searchParams.get("latest");
    if (latest === "true") {
      const report = await getLatestAmPerformance();
      return NextResponse.json({ report });
    }

    const reports = await getAmPerformanceReports();
    return NextResponse.json({ reports });
  } catch (err) {
    console.error("Failed to fetch AM performance:", err);
    return NextResponse.json(
      { error: "Failed to fetch AM performance" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authErr = await requireGtmAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = v2AmPerformanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const report = await upsertAmPerformance({
      id: body.id, // optional — update if present
      ...parsed.data,
    });
    return NextResponse.json({ report });
  } catch (err) {
    console.error("Failed to save AM performance:", err);
    return NextResponse.json(
      { error: "Failed to save AM performance" },
      { status: 500 }
    );
  }
}
