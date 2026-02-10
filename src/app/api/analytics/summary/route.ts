import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/analytics/summary
// Query params:
//   days — lookback window in days (default 7, max 90)
//   user — optional user filter
//
// Returns: {
//   summary: { date: string, events: { [type]: number } }[],
//   totals: { [type]: number },
//   byUser: { [userName]: { [type]: number } }
// }
// ---------------------------------------------------------------------------

interface DaySummary {
  date: string;
  events: Record<string, number>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = Math.min(
      Math.max(parseInt(searchParams.get("days") ?? "7", 10) || 7, 1),
      90
    );
    const userFilter = searchParams.get("user") ?? null;

    const supabase = createServerClient();
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString();

    let query = supabase
      .from("usage_events")
      .select("event_type, user_name, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(10000);

    if (userFilter) {
      query = query.eq("user_name", userFilter);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("[Analytics/Summary] Supabase error:", error);
      return NextResponse.json(
        { summary: [], totals: {}, byUser: {}, error: "Failed to query events" },
        { status: 500 }
      );
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ summary: [], totals: {}, byUser: {} });
    }

    // Aggregate by date
    const dateMap = new Map<string, Record<string, number>>();
    const totals: Record<string, number> = {};
    const byUser: Record<string, Record<string, number>> = {};

    for (const evt of events) {
      const dateKey = new Date(evt.created_at).toISOString().slice(0, 10);
      const eventType = evt.event_type;
      const userName = evt.user_name;

      // Date aggregation
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {});
      }
      const dayEvents = dateMap.get(dateKey)!;
      dayEvents[eventType] = (dayEvents[eventType] ?? 0) + 1;

      // Totals
      totals[eventType] = (totals[eventType] ?? 0) + 1;

      // By user
      if (!byUser[userName]) {
        byUser[userName] = {};
      }
      byUser[userName][eventType] = (byUser[userName][eventType] ?? 0) + 1;
    }

    // Build sorted summary array
    const summary: DaySummary[] = [];
    for (const [date, evts] of dateMap) {
      summary.push({ date, events: evts });
    }
    summary.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ summary, totals, byUser });
  } catch (err) {
    console.error("[Analytics/Summary] Unexpected error:", err);
    return NextResponse.json(
      { summary: [], totals: {}, byUser: {}, error: "Internal server error" },
      { status: 500 }
    );
  }
}
