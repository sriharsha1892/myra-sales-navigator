import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildWeeklyDigestCard } from "@/lib/navigator/teams/cards";
import { sendToChannel, getTeamsConfig } from "@/lib/navigator/teams/sender";
import type { WeeklyDigestStats } from "@/lib/navigator/teams/types";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://myra-sales-navigator.vercel.app";

function formatPeriod(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(start)} \u2013 ${fmt.format(end)}`;
}

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Teams config
    const config = await getTeamsConfig();
    if (!config?.teamsEnabled) {
      return NextResponse.json({ skipped: true, reason: "Teams not enabled" });
    }
    if (!config.enabledNotifications.includes("weekly")) {
      return NextResponse.json({
        skipped: true,
        reason: "weekly notification not enabled",
      });
    }

    const supabase = createServerClient();

    // Compute the past 7 days window
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    // Period string (e.g. "Feb 3 - Feb 9")
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() - 1); // Yesterday as end of period
    const period = formatPeriod(weekAgo, periodEnd);

    // Aggregate stats in parallel
    const [
      exportsResult,
      enrollmentsResult,
      stepLogsResult,
      searchHistoryResult,
      activeUsersResult,
    ] = await Promise.all([
      supabase
        .from("contact_extractions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgoISO),

      supabase
        .from("outreach_enrollments")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgoISO),

      supabase
        .from("outreach_step_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("created_at", weekAgoISO),

      supabase
        .from("search_history")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgoISO),

      supabase
        .from("outreach_enrollments")
        .select("enrolled_by")
        .gte("created_at", weekAgoISO),
    ]);

    // Extract distinct active users
    const activeUsersSet = new Set<string>(
      (activeUsersResult.data ?? []).map(
        (row: { enrolled_by: string }) => row.enrolled_by
      )
    );

    const stats: WeeklyDigestStats = {
      exportsCount: exportsResult.count ?? 0,
      sequencesStarted: enrollmentsResult.count ?? 0,
      stepsCompleted: stepLogsResult.count ?? 0,
      companiesDiscovered: searchHistoryResult.count ?? 0,
      activeUsers: [...activeUsersSet],
      period,
    };

    const card = buildWeeklyDigestCard(stats, APP_URL);
    const sent = await sendToChannel(card);

    return NextResponse.json({ success: true, sent, stats });
  } catch (err) {
    console.error("[teams-weekly] Cron error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
