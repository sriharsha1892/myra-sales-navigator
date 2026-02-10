import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/navigator/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/search-quality
 *
 * Returns aggregated search quality metrics for the last N days.
 * Admin-only: verifies session token and checks isAdmin flag.
 *
 * Query params:
 *   ?days=7 (default 7)
 */
export async function GET(request: Request) {
  // --- Auth check ---
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("myra_session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { isAdmin } = await verifySessionToken(sessionCookie);
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  // --- Parse params ---
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") ?? "7", 10) || 7, 1), 90);

  try {
    const supabase = createServerClient();
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data } = await supabase
      .from("search_history")
      .select("created_at, result_count, total_duration_ms, search_engine, engine_errors, query_simplified, unenriched_count")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });

    if (!data) {
      return NextResponse.json({ metrics: null });
    }

    // Compute aggregate metrics
    const totalSearches = data.length;
    const emptySearches = data.filter((r) => (r.result_count ?? 0) === 0).length;
    const avgResults = totalSearches > 0
      ? data.reduce((s, r) => s + (r.result_count ?? 0), 0) / totalSearches
      : 0;
    const avgDurationMs = totalSearches > 0
      ? data.reduce((s, r) => s + (r.total_duration_ms ?? 0), 0) / totalSearches
      : 0;
    const simplifiedCount = data.filter((r) => r.query_simplified).length;
    const avgUnenriched = totalSearches > 0
      ? data.reduce((s, r) => s + (r.unenriched_count ?? 0), 0) / totalSearches
      : 0;

    // Per-engine breakdown
    const engineCounts: Record<string, number> = {};
    const engineErrors: Record<string, number> = {};
    for (const row of data) {
      const eng = row.search_engine ?? "unknown";
      engineCounts[eng] = (engineCounts[eng] ?? 0) + 1;
      const errs = (row.engine_errors as unknown[]) ?? [];
      if (errs.length > 0) engineErrors[eng] = (engineErrors[eng] ?? 0) + 1;
    }

    return NextResponse.json({
      days,
      totalSearches,
      emptySearches,
      emptyPct: totalSearches > 0 ? Math.round((emptySearches / totalSearches) * 100 * 10) / 10 : 0,
      avgResults: Math.round(avgResults * 10) / 10,
      avgDurationMs: Math.round(avgDurationMs),
      simplifiedCount,
      avgUnenriched: Math.round(avgUnenriched * 10) / 10,
      engineCounts,
      engineErrors,
    });
  } catch (err) {
    console.error("[SearchQuality] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch search quality metrics" },
      { status: 500 }
    );
  }
}
