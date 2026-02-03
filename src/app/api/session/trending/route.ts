import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sb = createServerClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get companies viewed by 2+ distinct users in the last 7 days
    // Supabase doesn't support COUNT(DISTINCT) easily, so we use RPC or raw query
    const { data: recentCompanies, error } = await sb
      .from("companies")
      .select("domain, name, last_viewed_at, last_viewed_by, viewed_by")
      .gte("last_viewed_at", sevenDaysAgo)
      .order("last_viewed_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Trending] query error:", error);
      return NextResponse.json({ trending: [] });
    }

    // Group by domain and collect unique viewers
    const domainMap = new Map<string, { domain: string; name: string; viewers: Set<string>; lastViewed: string }>();
    for (const c of recentCompanies ?? []) {
      const existing = domainMap.get(c.domain);
      if (existing) {
        if (c.viewed_by) existing.viewers.add(c.viewed_by);
        if (c.last_viewed_by) existing.viewers.add(c.last_viewed_by);
      } else {
        const viewers = new Set<string>();
        if (c.viewed_by) viewers.add(c.viewed_by);
        if (c.last_viewed_by) viewers.add(c.last_viewed_by);
        domainMap.set(c.domain, {
          domain: c.domain,
          name: c.name,
          viewers,
          lastViewed: c.last_viewed_at,
        });
      }
    }

    // Filter to 2+ viewers and take top 5
    const trending = Array.from(domainMap.values())
      .filter((d) => d.viewers.size >= 2)
      .sort((a, b) => b.viewers.size - a.viewers.size)
      .slice(0, 5)
      .map((d) => ({
        domain: d.domain,
        name: d.name,
        viewerCount: d.viewers.size,
        viewerNames: Array.from(d.viewers),
        lastViewed: d.lastViewed,
      }));

    return NextResponse.json({ trending });
  } catch (err) {
    console.error("[Trending] error:", err);
    return NextResponse.json({ trending: [] });
  }
}
