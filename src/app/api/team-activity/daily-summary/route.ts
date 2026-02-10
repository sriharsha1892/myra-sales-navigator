import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();

  // Yesterday's date range
  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const [sessionsRes, stepsRes] = await Promise.allSettled([
    supabase
      .from("user_sessions")
      .select("user_name, company_view_count, export_count")
      .gte("started_at", yesterdayStart.toISOString())
      .lte("started_at", yesterdayEnd.toISOString()),
    supabase
      .from("outreach_step_logs")
      .select("id")
      .eq("status", "completed")
      .gte("completed_at", yesterdayStart.toISOString())
      .lte("completed_at", yesterdayEnd.toISOString()),
  ]);

  let companiesReviewed = 0;
  let contactsExported = 0;
  let activeMembers = 0;

  if (sessionsRes.status === "fulfilled" && sessionsRes.value.data) {
    const sessions = sessionsRes.value.data;
    const uniqueUsers = new Set(
      sessions.map((s: { user_name: string }) => s.user_name)
    );
    activeMembers = uniqueUsers.size;
    companiesReviewed = sessions.reduce(
      (sum: number, s: { company_view_count: number }) =>
        sum + (s.company_view_count ?? 0),
      0
    );
    contactsExported = sessions.reduce(
      (sum: number, s: { export_count: number }) =>
        sum + (s.export_count ?? 0),
      0
    );
  }

  let outreachSteps = 0;
  if (stepsRes.status === "fulfilled" && stepsRes.value.data) {
    outreachSteps = stepsRes.value.data.length;
  }

  return NextResponse.json({
    companiesReviewed,
    contactsExported,
    outreachSteps,
    activeMembers,
  });
}
