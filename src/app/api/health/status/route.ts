import { NextResponse } from "next/server";
import { getHealthSummary } from "@/lib/navigator/health";

export async function GET() {
  try {
    const summary = await getHealthSummary(1);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[Health] Failed to get health summary:", err);
    return NextResponse.json(
      { sources: {}, recentErrors: [], error: "Failed to load health data" },
      { status: 500 }
    );
  }
}
