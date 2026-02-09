import { NextRequest, NextResponse } from "next/server";
import { buildExportSummaryCard, buildAnnouncementCard } from "@/lib/navigator/teams/cards";
import { getTeamsConfig, sendToChannel, sendToUser, getAllTeamsUsers } from "@/lib/navigator/teams/sender";
import type { ExportSummaryData, AnnouncementData } from "@/lib/navigator/teams/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://myra-sales-navigator.vercel.app";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, payload } = body as {
      type: "export" | "announcement";
      payload: Record<string, unknown>;
    };

    if (!type || !payload) {
      return NextResponse.json({ error: "Missing type or payload" }, { status: 400 });
    }

    // Check if Teams is enabled and notification type is allowed
    const config = await getTeamsConfig();
    if (!config) {
      return NextResponse.json({ success: false, reason: "Teams not configured" });
    }

    // Map notification type to enabledNotifications key
    const typeKey = type === "export" ? "exports" : "announcements";
    if (!config.enabledNotifications.includes(typeKey)) {
      return NextResponse.json({ success: false, reason: `Notification type "${typeKey}" not enabled` });
    }

    if (type === "export") {
      const data: ExportSummaryData = {
        userName: String(payload.userName ?? "Unknown"),
        contactCount: Number(payload.contactCount ?? 0),
        companyDomain: String(payload.companyDomain ?? "unknown"),
        format: String(payload.format ?? "clipboard"),
      };
      const card = buildExportSummaryCard(data, APP_URL);
      await sendToChannel(card);
      return NextResponse.json({ success: true });
    }

    if (type === "announcement") {
      const data: AnnouncementData = {
        title: String(payload.title ?? ""),
        body: String(payload.body ?? ""),
        author: String(payload.author ?? "System"),
      };
      const card = buildAnnouncementCard(data);
      await sendToChannel(card);

      // If sendToAll, also DM every user with Teams enabled
      if (payload.sendToAll === true) {
        const users = await getAllTeamsUsers();
        await Promise.allSettled(
          users.map((u) => sendToUser(u.userName, card))
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  } catch (err) {
    console.error("[Teams notify] Error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
