import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const user = request.nextUrl.searchParams.get("user");
    if (!user) {
      return NextResponse.json({ error: "user param required" }, { status: 400 });
    }

    const sb = createServerClient();

    // Last 10 viewed companies by this user
    const { data: recentCompanies } = await sb
      .from("companies")
      .select("domain, name, status, last_viewed_at")
      .eq("last_viewed_by", user)
      .order("last_viewed_at", { ascending: false })
      .limit(10);

    // Last 3 searches by this user
    const { data: recentSearches } = await sb
      .from("search_history")
      .select("id, label, filters, result_count, created_at")
      .eq("user_name", user)
      .order("created_at", { ascending: false })
      .limit(3);

    // In-progress pipeline items (researching, contacted, demo_scheduled)
    const { data: inProgress } = await sb
      .from("companies")
      .select("domain, name, status, status_changed_at")
      .in("status", ["researching", "contacted", "demo_scheduled"])
      .order("status_changed_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      recentCompanies: recentCompanies ?? [],
      recentSearches: (recentSearches ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        filters: s.filters,
        resultCount: s.result_count,
        timestamp: s.created_at,
      })),
      inProgress: inProgress ?? [],
    });
  } catch (err) {
    console.error("GET /api/session/resume error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
