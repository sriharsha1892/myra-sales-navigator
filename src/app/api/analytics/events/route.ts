import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Supabase table definition (run this migration manually):
//
// CREATE TABLE IF NOT EXISTS usage_events (
//   id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   event_type   text NOT NULL,
//   user_name    text NOT NULL,
//   metadata     jsonb,
//   created_at   timestamptz DEFAULT now()
// );
//
// CREATE INDEX idx_usage_events_type ON usage_events (event_type);
// CREATE INDEX idx_usage_events_user ON usage_events (user_name);
// CREATE INDEX idx_usage_events_created ON usage_events (created_at);
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES = new Set([
  "search",
  "dossier_view",
  "export",
  "draft",
  "enrollment",
]);

export async function POST(request: Request) {
  try {
    let body: { eventType?: string; userName?: string; metadata?: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { eventType, userName, metadata } = body;

    if (!eventType || !userName) {
      return NextResponse.json(
        { error: "Missing required fields: eventType, userName" },
        { status: 400 }
      );
    }

    if (!VALID_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType: ${eventType}. Must be one of: ${[...VALID_EVENT_TYPES].join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("usage_events").insert({
      event_type: eventType,
      user_name: userName,
      metadata: metadata ?? null,
    });

    if (error) {
      console.error("[Analytics/Events] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to track event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[Analytics/Events] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
