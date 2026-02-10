import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/health/latency-trends
// Query params:
//   hours    — lookback window (default 24)
//   provider — filter by provider name, or "all" (default "all")
//
// Returns: { trends: { provider: string, data: { hour: string, avgMs: number, errorRate: number }[] }[] }
// ---------------------------------------------------------------------------

interface HourBucket {
  hour: string;       // ISO hour string e.g. "2026-02-10T14:00:00.000Z"
  avgMs: number;
  errorRate: number;  // 0-100
}

interface ProviderTrend {
  provider: string;
  data: HourBucket[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const hours = Math.min(Math.max(parseInt(searchParams.get("hours") ?? "24", 10) || 24, 1), 168); // cap at 7 days
    const provider = searchParams.get("provider") ?? "all";

    const supabase = createServerClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("api_health_log")
      .select("source, success, latency_ms, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(5000);

    if (provider !== "all") {
      query = query.eq("source", provider);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error("[LatencyTrends] Supabase query error:", error);
      return NextResponse.json(
        { trends: [], error: "Failed to query health logs" },
        { status: 500 }
      );
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({ trends: [] });
    }

    // Group by provider + hour bucket
    const grouped = new Map<
      string,
      Map<string, { latencies: number[]; total: number; failures: number }>
    >();

    for (const log of logs) {
      const src = log.source;
      const createdAt = new Date(log.created_at);
      // Truncate to hour
      const hourKey = new Date(
        createdAt.getFullYear(),
        createdAt.getMonth(),
        createdAt.getDate(),
        createdAt.getHours()
      ).toISOString();

      if (!grouped.has(src)) {
        grouped.set(src, new Map());
      }
      const providerMap = grouped.get(src)!;
      if (!providerMap.has(hourKey)) {
        providerMap.set(hourKey, { latencies: [], total: 0, failures: 0 });
      }

      const bucket = providerMap.get(hourKey)!;
      bucket.total++;
      if (!log.success) bucket.failures++;
      if (log.latency_ms != null) bucket.latencies.push(log.latency_ms);
    }

    // Build response
    const trends: ProviderTrend[] = [];

    for (const [src, hourMap] of grouped) {
      const data: HourBucket[] = [];
      for (const [hour, bucket] of hourMap) {
        const avgMs =
          bucket.latencies.length > 0
            ? Math.round(
                bucket.latencies.reduce((a, b) => a + b, 0) /
                  bucket.latencies.length
              )
            : 0;
        const errorRate =
          bucket.total > 0
            ? Math.round((bucket.failures / bucket.total) * 1000) / 10
            : 0;
        data.push({ hour, avgMs, errorRate });
      }
      // Sort by hour ascending
      data.sort((a, b) => a.hour.localeCompare(b.hour));
      trends.push({ provider: src, data });
    }

    // Sort providers alphabetically
    trends.sort((a, b) => a.provider.localeCompare(b.provider));

    return NextResponse.json({ trends });
  } catch (err) {
    console.error("[LatencyTrends] Unexpected error:", err);
    return NextResponse.json(
      { trends: [], error: "Internal server error" },
      { status: 500 }
    );
  }
}
