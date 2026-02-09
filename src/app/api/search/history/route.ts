import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const userName = request.nextUrl.searchParams.get("user");

    let query = supabase
      .from("search_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (userName) {
      query = query.eq("user_name", userName);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[SearchHistory] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch search history" }, { status: 500 });
    }

    const history = (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_name,
      filters: row.filters,
      resultCount: row.result_count,
      label: row.label ?? undefined,
      timestamp: row.created_at,
      // Search performance fields
      totalDurationMs: row.total_duration_ms ?? undefined,
      reformulationMs: row.reformulation_ms ?? undefined,
      exaDurationMs: row.exa_duration_ms ?? undefined,
      apolloDurationMs: row.apollo_duration_ms ?? undefined,
      nlIcpScoringMs: row.nl_icp_scoring_ms ?? undefined,
      exaCacheHit: row.exa_cache_hit ?? undefined,
      exaResultCount: row.exa_result_count ?? undefined,
      apolloEnrichedCount: row.apollo_enriched_count ?? undefined,
      highFitCount: row.high_fit_count ?? undefined,
      exaError: row.exa_error ?? undefined,
      apolloError: row.apollo_error ?? undefined,
      nlIcpError: row.nl_icp_error ?? undefined,
      queryText: row.query_text ?? undefined,
    }));

    return NextResponse.json({ history });
  } catch (err) {
    console.error("[SearchHistory] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch search history" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userName, filters, resultCount, label } = await request.json();
    if (!userName || !filters) {
      return NextResponse.json(
        { error: "userName and filters are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("search_history")
      .insert({
        user_name: userName,
        filters,
        result_count: resultCount ?? 0,
        label: label ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[SearchHistory] insert error:", error);
      return NextResponse.json({ error: "Failed to save search" }, { status: 500 });
    }

    return NextResponse.json({
      entry: {
        id: data.id,
        userId: data.user_name,
        filters: data.filters,
        resultCount: data.result_count,
        label: data.label ?? undefined,
        timestamp: data.created_at,
      },
    });
  } catch (err) {
    console.error("[SearchHistory] POST error:", err);
    return NextResponse.json({ error: "Failed to save search" }, { status: 500 });
  }
}
