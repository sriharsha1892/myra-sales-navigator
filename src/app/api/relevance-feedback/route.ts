import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const {
      domain,
      feedback,
      reason,
      userName,
      searchQuery,
      companyIndustry,
      companyRegion,
      companySizeBucket,
      icpScore,
    } = await request.json();

    if (!domain || !feedback || !userName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("relevance_feedback")
      .upsert(
        {
          domain,
          feedback,
          reason: reason ?? null,
          search_query: searchQuery ?? null,
          user_name: userName,
          company_industry: companyIndustry ?? null,
          company_region: companyRegion ?? null,
          company_size_bucket: companySizeBucket ?? null,
          icp_score: icpScore ?? null,
        },
        { onConflict: "domain,user_name" }
      );

    if (error) {
      console.error("[relevance-feedback] upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[relevance-feedback] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { domain } = body;
    if (!domain) {
      return NextResponse.json({ error: "Missing domain" }, { status: 400 });
    }

    // Get requester from cookie
    const cookieStore = await cookies();
    const requesterName = cookieStore.get("user_name")?.value;
    if (!requesterName) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Admin undo: if userName provided and requester is admin, delete that user's feedback
    const adminUsers = (process.env.ADMIN_USERS ?? "").split(",").map((u) => u.trim().toLowerCase());
    const isAdmin = adminUsers.includes(requesterName.toLowerCase());
    const targetUser = body.userName && isAdmin ? body.userName : requesterName;

    const supabase = createServerClient();
    const { error } = await supabase
      .from("relevance_feedback")
      .delete()
      .eq("domain", domain)
      .eq("user_name", targetUser);

    if (error) {
      console.error("[relevance-feedback] delete error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[relevance-feedback] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const aggregate = searchParams.get("aggregate") === "true";
    const days = parseInt(searchParams.get("days") ?? "7", 10);

    const supabase = createServerClient();

    // List mode: return individual rows for admin undo
    const list = searchParams.get("list") === "true";
    if (list) {
      const { data: rows, error: listError } = await supabase
        .from("relevance_feedback")
        .select("domain, feedback, reason, user_name, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (listError) {
        console.error("[relevance-feedback] list error:", listError.message);
        return NextResponse.json({ entries: [] });
      }

      return NextResponse.json({
        entries: (rows ?? []).map((r) => ({
          domain: r.domain,
          feedback: r.feedback,
          reason: r.reason,
          userName: r.user_name,
          createdAt: r.created_at,
        })),
      });
    }

    if (aggregate) {
      // Fetch all feedback rows from the last N days (both relevant and not_relevant)
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      const { data: allRows, error: fetchError } = await supabase
        .from("relevance_feedback")
        .select("feedback, reason, company_industry, company_region, company_size_bucket")
        .gte("created_at", cutoff);

      if (fetchError) {
        console.error("[relevance-feedback] aggregate error:", fetchError.message);
        return NextResponse.json({
          summary: { relevant: 0, notRelevant: 0 },
          reasons: [],
          topIndustries: [],
          topRegions: [],
          topSizes: [],
        });
      }

      const rows = allRows ?? [];

      // Summary counts
      let relevant = 0;
      let notRelevant = 0;
      for (const row of rows) {
        if (row.feedback === "relevant") relevant++;
        else if (row.feedback === "not_relevant") notRelevant++;
      }

      // Only aggregate negative feedback for breakdowns
      const negativeRows = rows.filter((r) => r.feedback === "not_relevant");

      // Reason distribution
      const reasonCounts = new Map<string, number>();
      for (const row of negativeRows) {
        if (row.reason) {
          reasonCounts.set(row.reason, (reasonCounts.get(row.reason) ?? 0) + 1);
        }
      }
      const reasons = [...reasonCounts.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      // Top industries
      const industryCounts = new Map<string, number>();
      for (const row of negativeRows) {
        if (row.company_industry) {
          industryCounts.set(row.company_industry, (industryCounts.get(row.company_industry) ?? 0) + 1);
        }
      }
      const topIndustries = [...industryCounts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top regions
      const regionCounts = new Map<string, number>();
      for (const row of negativeRows) {
        if (row.company_region) {
          regionCounts.set(row.company_region, (regionCounts.get(row.company_region) ?? 0) + 1);
        }
      }
      const topRegions = [...regionCounts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top size buckets
      const sizeCounts = new Map<string, number>();
      for (const row of negativeRows) {
        if (row.company_size_bucket) {
          sizeCounts.set(row.company_size_bucket, (sizeCounts.get(row.company_size_bucket) ?? 0) + 1);
        }
      }
      const topSizes = [...sizeCounts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return NextResponse.json({
        summary: { relevant, notRelevant },
        reasons,
        topIndustries,
        topRegions,
        topSizes,
      });
    }

    // Default: return all feedback for current user
    const cookieStore = await cookies();
    const userName = cookieStore.get("user_name")?.value;
    if (!userName) {
      return NextResponse.json({ feedback: [] });
    }

    const { data, error } = await supabase
      .from("relevance_feedback")
      .select("domain, feedback, reason, created_at")
      .eq("user_name", userName);

    if (error) {
      console.error("[relevance-feedback] query error:", error.message);
      return NextResponse.json({ feedback: [] });
    }

    return NextResponse.json({ feedback: data ?? [] });
  } catch (err) {
    console.error("[relevance-feedback] error:", err);
    return NextResponse.json({ feedback: [] });
  }
}
