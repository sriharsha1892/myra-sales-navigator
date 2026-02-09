import { NextRequest, NextResponse } from "next/server";
import { buildAnnouncementCard } from "@/lib/navigator/teams/cards";
import { sendToWebhookUrl } from "@/lib/navigator/teams/sender";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { webhookUrl, type } = body as {
      webhookUrl: string;
      type: "channel" | "personal";
    };

    if (!webhookUrl) {
      return NextResponse.json({ error: "Missing webhookUrl" }, { status: 400 });
    }

    const card = buildAnnouncementCard({
      title: "Test Notification",
      body: "This is a test from Sales Navigator. If you see this, Teams notifications are working!",
      author: "System",
    });

    const success = await sendToWebhookUrl(webhookUrl, card);

    return NextResponse.json({ success });
  } catch (err) {
    console.error("[Teams test] Error:", err);
    return NextResponse.json(
      { error: "Internal error", success: false },
      { status: 500 }
    );
  }
}
