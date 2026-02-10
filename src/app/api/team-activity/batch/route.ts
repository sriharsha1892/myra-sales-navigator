import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface ActivityRow {
  company_domain: string;
  user_name: string;
  activity_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface TeamActivitySummary {
  viewers: { user: string; at: string }[];
  exporters: { user: string; at: string; count: number }[];
  decisions: { user: string; decision: string; at: string }[];
}

export async function POST(request: Request) {
  try {
    const { domains, currentUser } = (await request.json()) as {
      domains: string[];
      currentUser: string;
    };

    if (!domains || !Array.isArray(domains) || domains.length === 0 || !currentUser) {
      return NextResponse.json({});
    }

    const supabase = createServerClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data, error } = await supabase
      .from("company_activity_log")
      .select("company_domain, user_name, activity_type, metadata, created_at")
      .in("company_domain", domains)
      .gte("created_at", sevenDaysAgo)
      .neq("user_name", currentUser)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error || !data) {
      return NextResponse.json({});
    }

    const result: Record<string, TeamActivitySummary> = {};

    for (const row of data as ActivityRow[]) {
      const domain = row.company_domain;
      if (!result[domain]) {
        result[domain] = { viewers: [], exporters: [], decisions: [] };
      }

      const summary = result[domain];
      const meta = row.metadata ?? {};

      switch (row.activity_type) {
        case "view":
          if (summary.viewers.length < 5) {
            // Dedup by user
            if (!summary.viewers.some((v) => v.user === row.user_name)) {
              summary.viewers.push({ user: row.user_name, at: row.created_at });
            }
          }
          break;
        case "export":
          if (summary.exporters.length < 5) {
            if (!summary.exporters.some((e) => e.user === row.user_name)) {
              summary.exporters.push({
                user: row.user_name,
                at: row.created_at,
                count: (meta.contactCount as number) ?? 0,
              });
            }
          }
          break;
        case "triage":
          if (summary.decisions.length < 5) {
            if (!summary.decisions.some((d) => d.user === row.user_name)) {
              summary.decisions.push({
                user: row.user_name,
                decision: (meta.decision as string) ?? "unknown",
                at: row.created_at,
              });
            }
          }
          break;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[team-activity/batch] error:", err);
    return NextResponse.json({});
  }
}
