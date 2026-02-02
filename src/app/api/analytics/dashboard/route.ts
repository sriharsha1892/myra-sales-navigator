import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = request.nextUrl;

    const now = new Date();
    const toParam = searchParams.get("to");
    const fromParam = searchParams.get("from");

    const rangeTo = toParam ? new Date(toParam + "T23:59:59.999Z") : now;
    const rangeFrom = fromParam
      ? new Date(fromParam + "T00:00:00.000Z")
      : new Date(new Date(now).setDate(now.getDate() - 7));

    // Parallel queries
    const [
      { data: extractions },
      { data: searches },
      { data: companies },
      { data: exclusions },
      { data: notes },
      { data: adminRow },
    ] = await Promise.all([
      supabase.from("contact_extractions").select("*"),
      supabase.from("search_history").select("*"),
      supabase.from("companies").select("*"),
      supabase.from("exclusions").select("*"),
      supabase.from("company_notes").select("*"),
      supabase
        .from("admin_config")
        .select("analytics_settings")
        .eq("id", "global")
        .single(),
    ]);

    const allExtractions = extractions ?? [];
    const allSearches = searches ?? [];
    const allCompanies = companies ?? [];
    const allExclusions = exclusions ?? [];
    const allNotes = notes ?? [];

    const analyticsSettings = (adminRow?.analytics_settings ?? {}) as {
      kpiTargets?: { exportsThisWeek?: number; avgIcpScore?: number };
    };
    const kpiTargets = {
      exportsThisWeek: analyticsSettings.kpiTargets?.exportsThisWeek ?? 20,
      avgIcpScore: analyticsSettings.kpiTargets?.avgIcpScore ?? 60,
    };

    // --- KPIs (filtered by date range) ---
    const exportsThisWeek = allExtractions.filter(
      (e) => {
        const d = new Date(e.extracted_at);
        return d >= rangeFrom && d <= rangeTo;
      }
    ).length;

    const prospectsDiscovered = allCompanies.filter(
      (c) => {
        const d = new Date(c.first_viewed_at);
        return d >= rangeFrom && d <= rangeTo;
      }
    ).length;

    const activeUserSet = new Set<string>();
    for (const s of allSearches) {
      const d = new Date(s.created_at);
      if (d >= rangeFrom && d <= rangeTo) {
        activeUserSet.add(s.user_name ?? s.user_id ?? "Unknown");
      }
    }
    for (const e of allExtractions) {
      const d = new Date(e.extracted_at);
      if (d >= rangeFrom && d <= rangeTo) {
        activeUserSet.add(e.extracted_by ?? "Unknown");
      }
    }
    const activeUsers = activeUserSet.size;

    const icpScores = allCompanies
      .map((c) => c.icp_score)
      .filter((s): s is number => typeof s === "number" && s > 0);
    const avgIcpScore =
      icpScores.length > 0
        ? Math.round(icpScores.reduce((a, b) => a + b, 0) / icpScores.length)
        : 0;

    // --- Funnel (filtered by date range) ---
    const totalSearches = allSearches.filter((s) => {
      const d = new Date(s.created_at);
      return d >= rangeFrom && d <= rangeTo;
    }).length;

    const companiesViewed = allCompanies.filter((c) => {
      if (!c.last_viewed_at) return false;
      const d = new Date(c.last_viewed_at);
      return d >= rangeFrom && d <= rangeTo;
    }).length;

    const contactsExtracted = allExtractions
      .filter((e) => {
        const d = new Date(e.extracted_at);
        return d >= rangeFrom && d <= rangeTo;
      })
      .reduce((sum, e) => {
        const contacts = e.contacts as unknown[];
        return sum + (Array.isArray(contacts) ? contacts.length : 0);
      }, 0);

    // --- Team Activity (lastActive stays absolute, counts filtered) ---
    const userMap = new Map<
      string,
      {
        searches: number;
        exports: number;
        notes: number;
        companiesViewed: number;
        lastActive: string;
      }
    >();

    function getOrCreate(name: string) {
      if (!userMap.has(name)) {
        userMap.set(name, {
          searches: 0,
          exports: 0,
          notes: 0,
          companiesViewed: 0,
          lastActive: "",
        });
      }
      return userMap.get(name)!;
    }

    function updateLastActive(entry: ReturnType<typeof getOrCreate>, date: string) {
      if (!entry.lastActive || date > entry.lastActive) {
        entry.lastActive = date;
      }
    }

    for (const s of allSearches) {
      const name = s.user_name ?? s.user_id ?? "Unknown";
      const entry = getOrCreate(name);
      const d = new Date(s.created_at);
      if (d >= rangeFrom && d <= rangeTo) {
        entry.searches++;
      }
      updateLastActive(entry, s.created_at);
    }

    for (const e of allExtractions) {
      const name = e.extracted_by ?? "Unknown";
      const entry = getOrCreate(name);
      const d = new Date(e.extracted_at);
      if (d >= rangeFrom && d <= rangeTo) {
        entry.exports++;
      }
      updateLastActive(entry, e.extracted_at);
    }

    for (const n of allNotes) {
      const name = n.author_name ?? "Unknown";
      const entry = getOrCreate(name);
      const d = new Date(n.created_at);
      if (d >= rangeFrom && d <= rangeTo) {
        entry.notes++;
      }
      updateLastActive(entry, n.created_at);
    }

    for (const c of allCompanies) {
      if (c.last_viewed_by) {
        const entry = getOrCreate(c.last_viewed_by);
        if (c.last_viewed_at) {
          const d = new Date(c.last_viewed_at);
          if (d >= rangeFrom && d <= rangeTo) {
            entry.companiesViewed++;
          }
          updateLastActive(entry, c.last_viewed_at);
        }
      }
    }

    const teamActivity = Array.from(userMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .filter((u) => u.searches + u.exports + u.notes + u.companiesViewed > 0)
      .sort((a, b) => b.searches + b.exports - (a.searches + a.exports));

    // --- Source Performance ---
    const sourceMap = new Map<
      string,
      { companies: number; icpScores: number[]; contacts: number; extractions: number }
    >();

    function getOrCreateSource(source: string) {
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { companies: 0, icpScores: [], contacts: 0, extractions: 0 });
      }
      return sourceMap.get(source)!;
    }

    for (const c of allCompanies) {
      const source = c.source ?? "exa";
      const entry = getOrCreateSource(source);
      entry.companies++;
      if (typeof c.icp_score === "number" && c.icp_score > 0) {
        entry.icpScores.push(c.icp_score);
      }
    }

    for (const e of allExtractions) {
      const domain = e.company_domain;
      const company = allCompanies.find((c) => c.domain === domain);
      const source = company?.source ?? "exa";
      const entry = getOrCreateSource(source);
      const contacts = e.contacts as unknown[];
      const contactCount = Array.isArray(contacts) ? contacts.length : 0;
      entry.contacts += contactCount;
      entry.extractions++;
    }

    const sourcePerformance = Array.from(sourceMap.entries()).map(
      ([source, stats]) => ({
        source,
        companies: stats.companies,
        avgIcp:
          stats.icpScores.length > 0
            ? Math.round(
                stats.icpScores.reduce((a, b) => a + b, 0) / stats.icpScores.length
              )
            : 0,
        contacts: stats.contacts,
        extractionRate:
          stats.companies > 0
            ? Math.round((stats.extractions / stats.companies) * 100)
            : 0,
      })
    );

    // --- Filter Heatmap ---
    const verticals: Record<string, number> = {};
    const regions: Record<string, number> = {};

    for (const s of allSearches) {
      const filters = s.filters as {
        verticals?: string[];
        regions?: string[];
      } | null;
      if (filters?.verticals) {
        for (const v of filters.verticals) {
          verticals[v] = (verticals[v] ?? 0) + 1;
        }
      }
      if (filters?.regions) {
        for (const r of filters.regions) {
          regions[r] = (regions[r] ?? 0) + 1;
        }
      }
    }

    // --- Exclusions ---
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};

    for (const e of allExclusions) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      bySource[e.source ?? "manual"] = (bySource[e.source ?? "manual"] ?? 0) + 1;
      if (e.reason) {
        reasonCounts[e.reason] = (reasonCounts[e.reason] ?? 0) + 1;
      }
    }

    const topReasons = Object.entries(reasonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    const recent = allExclusions
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 10)
      .map((e) => ({
        type: e.type,
        value: e.value,
        reason: e.reason,
        addedBy: e.added_by,
        addedAt: e.created_at,
      }));

    return NextResponse.json({
      kpis: { exportsThisWeek, prospectsDiscovered, activeUsers, avgIcpScore },
      kpiTargets,
      funnel: {
        searches: totalSearches,
        companiesViewed,
        contactsExtracted,
      },
      teamActivity,
      sourcePerformance,
      filterHeatmap: { verticals, regions },
      exclusions: { byType, topReasons, bySource, recent },
    });
  } catch (err) {
    console.error("Analytics dashboard error:", err);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}
