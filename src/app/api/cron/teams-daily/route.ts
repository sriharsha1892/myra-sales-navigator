import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildDueStepsCard } from "@/lib/navigator/teams/cards";
import {
  sendToUser,
  sendToChannel,
  getTeamsConfig,
  getAllTeamsUsers,
} from "@/lib/navigator/teams/sender";
import type { DueStepCardItem } from "@/lib/navigator/teams/types";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://myra-sales-navigator.vercel.app";

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
    if (!config.enabledNotifications.includes("due_steps")) {
      return NextResponse.json({
        skipped: true,
        reason: "due_steps notification not enabled",
      });
    }

    // Get all users with Teams enabled
    const users = await getAllTeamsUsers();
    if (users.length === 0) {
      return NextResponse.json({ skipped: true, reason: "No Teams users" });
    }

    const supabase = createServerClient();

    // End of today in UTC (we query for steps due at or before end of today)
    const now = new Date();
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)
    );
    const endOfTodayISO = endOfToday.toISOString();

    const results: {
      user: string;
      dueCount: number;
      sent: boolean;
      method: "personal" | "channel" | "none";
    }[] = [];

    for (const user of users) {
      try {
        // Query due steps for this user
        const { data: enrollments } = await supabase
          .from("outreach_enrollments")
          .select("id, contact_name, company_name, sequence_id, current_step, next_step_due_at")
          .eq("status", "active")
          .eq("enrolled_by", user.userName)
          .lte("next_step_due_at", endOfTodayISO);

        if (!enrollments || enrollments.length === 0) {
          results.push({ user: user.userName, dueCount: 0, sent: false, method: "none" });
          continue;
        }

        // Batch-fetch sequences for the enrollments
        const sequenceIds = [...new Set(enrollments.map((e) => e.sequence_id))];
        const { data: sequences } = await supabase
          .from("outreach_sequences")
          .select("id, name, steps")
          .in("id", sequenceIds);

        const sequenceMap = new Map(
          (sequences ?? []).map((s) => [s.id, s])
        );

        // Build card items
        const items: DueStepCardItem[] = enrollments.map((enrollment) => {
          const sequence = sequenceMap.get(enrollment.sequence_id);
          const steps = (sequence?.steps ?? []) as { channel?: string }[];
          const currentStep = enrollment.current_step ?? 0;
          const stepDef = steps[currentStep];

          return {
            contactName: enrollment.contact_name ?? "Unknown Contact",
            companyName: enrollment.company_name ?? "Unknown Company",
            channel: stepDef?.channel ?? "email",
            stepNumber: currentStep + 1,
            totalSteps: steps.length,
          };
        });

        if (items.length === 0) {
          results.push({ user: user.userName, dueCount: 0, sent: false, method: "none" });
          continue;
        }

        const card = buildDueStepsCard(items, user.userName, APP_URL);

        // Try personal webhook first, fall back to channel
        if (user.webhookUrl) {
          const sent = await sendToUser(user.userName, card);
          results.push({
            user: user.userName,
            dueCount: items.length,
            sent,
            method: "personal",
          });
        } else {
          // TODO: Re-enable channel fallback once Teams admin access is available
          // const channelCard = buildDueStepsCard(items, `@${user.userName}`, APP_URL);
          // const sent = await sendToChannel(channelCard);
          results.push({
            user: user.userName,
            dueCount: items.length,
            sent: false,
            method: "none",
          });
        }
      } catch (err) {
        console.error(`[teams-daily] Error processing user ${user.userName}:`, err);
        results.push({ user: user.userName, dueCount: 0, sent: false, method: "none" });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[teams-daily] Cron error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
