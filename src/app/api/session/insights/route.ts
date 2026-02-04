import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user");
  const sb = getSupabase();

  const result: {
    staleResearching: { domain: string; name: string; daysSince: number }[];
    followUpCount: number;
    recentVerticals: string[];
    suggestedVertical: string | null;
  } = {
    staleResearching: [],
    followUpCount: 0,
    recentVerticals: [],
    suggestedVertical: null,
  };

  if (!sb) {
    return NextResponse.json(result);
  }

  try {
    // Stale researching: companies with status=researching + statusChangedAt > 5d ago
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleCompanies } = await sb
      .from("companies")
      .select("domain, name, status_changed_at")
      .eq("status", "researching")
      .lt("status_changed_at", fiveDaysAgo)
      .limit(10);

    if (staleCompanies) {
      result.staleResearching = staleCompanies.map((c) => ({
        domain: c.domain,
        name: c.name,
        daysSince: Math.floor(
          (Date.now() - new Date(c.status_changed_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));
    }

    // Follow-up count: exports 3-14 days old
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    let exportQuery = sb
      .from("exported_contacts")
      .select("id", { count: "exact", head: true })
      .gte("exported_at", fourteenDaysAgo)
      .lte("exported_at", threeDaysAgo);

    if (user) {
      exportQuery = exportQuery.eq("exported_by", user);
    }

    const { count } = await exportQuery;
    result.followUpCount = count ?? 0;

    // Recent verticals from last 5 searches
    const { data: searches } = await sb
      .from("search_history")
      .select("filters")
      .order("created_at", { ascending: false })
      .limit(5);

    if (searches) {
      const verticals = new Set<string>();
      for (const s of searches) {
        const filters = s.filters as { verticals?: string[] } | null;
        if (filters?.verticals) {
          for (const v of filters.verticals) verticals.add(v);
        }
      }
      result.recentVerticals = [...verticals];
    }

    // Suggested vertical: find admin verticals not in recent searches
    const { data: adminData } = await sb
      .from("admin_config")
      .select("verticals")
      .eq("id", "global")
      .single();

    if (adminData?.verticals && Array.isArray(adminData.verticals)) {
      const unexplored = (adminData.verticals as string[]).filter(
        (v) => !result.recentVerticals.includes(v)
      );
      result.suggestedVertical = unexplored.length > 0 ? unexplored[0] : null;
    }
  } catch (err) {
    console.error("[Session Insights] Error:", err);
  }

  return NextResponse.json(result);
}
