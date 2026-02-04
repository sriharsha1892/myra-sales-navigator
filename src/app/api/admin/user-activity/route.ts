import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const user = url.searchParams.get("user");

  try {
    const sb = createServerClient();

    // Get search history aggregated by user
    let searchQuery = sb
      .from("search_history")
      .select("user_name, label, result_count, created_at");
    if (from) searchQuery = searchQuery.gte("created_at", from);
    if (to) searchQuery = searchQuery.lte("created_at", `${to}T23:59:59`);
    if (user) searchQuery = searchQuery.eq("user_name", user);
    const { data: searches } = await searchQuery.order("created_at", { ascending: false }).limit(200);

    // Get company views
    let viewQuery = sb
      .from("companies")
      .select("domain, name, last_viewed_by, last_viewed_at")
      .not("last_viewed_by", "is", null);
    if (from) viewQuery = viewQuery.gte("last_viewed_at", from);
    if (to) viewQuery = viewQuery.lte("last_viewed_at", `${to}T23:59:59`);
    if (user) viewQuery = viewQuery.eq("last_viewed_by", user);
    const { data: views } = await viewQuery.order("last_viewed_at", { ascending: false }).limit(200);

    // Get contact extractions
    let extractQuery = sb
      .from("contact_extractions")
      .select("company_domain, extracted_by, extracted_at, destination, contact_count");
    if (from) extractQuery = extractQuery.gte("extracted_at", from);
    if (to) extractQuery = extractQuery.lte("extracted_at", `${to}T23:59:59`);
    if (user) extractQuery = extractQuery.eq("extracted_by", user);
    const { data: extractions } = await extractQuery.order("extracted_at", { ascending: false }).limit(200);

    // Aggregate per user
    const userStats = new Map<string, {
      searches: number;
      companiesViewed: number;
      exports: number;
      contactsExported: number;
      lastActive: string;
    }>();

    const ensure = (name: string) => {
      if (!userStats.has(name)) {
        userStats.set(name, { searches: 0, companiesViewed: 0, exports: 0, contactsExported: 0, lastActive: "" });
      }
      return userStats.get(name)!;
    };

    for (const s of searches ?? []) {
      const u = ensure(s.user_name);
      u.searches++;
      if (s.created_at > u.lastActive) u.lastActive = s.created_at;
    }

    for (const v of views ?? []) {
      const u = ensure(v.last_viewed_by);
      u.companiesViewed++;
      if (v.last_viewed_at > u.lastActive) u.lastActive = v.last_viewed_at;
    }

    for (const e of extractions ?? []) {
      const u = ensure(e.extracted_by);
      u.exports++;
      u.contactsExported += e.contact_count ?? 0;
      if (e.extracted_at > u.lastActive) u.lastActive = e.extracted_at;
    }

    // Build timeline for drill-down (if specific user)
    const timeline: { type: string; text: string; at: string }[] = [];
    if (user) {
      for (const s of searches ?? []) {
        timeline.push({ type: "search", text: `Searched "${s.label || "filters"}" (${s.result_count ?? 0} results)`, at: s.created_at });
      }
      for (const v of views ?? []) {
        timeline.push({ type: "view", text: `Viewed ${v.name || v.domain}`, at: v.last_viewed_at });
      }
      for (const e of extractions ?? []) {
        timeline.push({ type: "export", text: `Exported ${e.contact_count ?? 0} contacts from ${e.company_domain}`, at: e.extracted_at });
      }
      timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }

    const summary = Array.from(userStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());

    return NextResponse.json({ summary, timeline: timeline.slice(0, 50) });
  } catch (err) {
    console.error("[UserActivity] error:", err);
    return NextResponse.json({ summary: [], timeline: [] });
  }
}
