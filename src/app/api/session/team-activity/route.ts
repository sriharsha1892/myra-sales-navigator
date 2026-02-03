import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sb = createServerClient();

    // Get last 10 company views
    const { data: recentViews } = await sb
      .from("companies")
      .select("domain, name, last_viewed_by, last_viewed_at")
      .not("last_viewed_by", "is", null)
      .order("last_viewed_at", { ascending: false })
      .limit(10);

    // Get last 10 search history entries
    const { data: recentSearches } = await sb
      .from("search_history")
      .select("user_name, label, result_count, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    // Merge and sort by timestamp
    const activities: { type: string; text: string; user: string; at: string }[] = [];

    for (const v of recentViews ?? []) {
      activities.push({
        type: "view",
        text: `Viewed ${v.name || v.domain}`,
        user: v.last_viewed_by,
        at: v.last_viewed_at,
      });
    }

    for (const s of recentSearches ?? []) {
      activities.push({
        type: "search",
        text: `Searched "${s.label || "filters"}" (${s.result_count ?? 0} results)`,
        user: s.user_name,
        at: s.created_at,
      });
    }

    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json({ activities: activities.slice(0, 10) });
  } catch (err) {
    console.error("[TeamActivity] error:", err);
    return NextResponse.json({ activities: [] });
  }
}
