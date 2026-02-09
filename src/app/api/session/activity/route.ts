import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Stale session threshold: 20 minutes
const STALE_THRESHOLD_MIN = 20;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    // Support both application/json and text/plain (sendBeacon)
    const contentType = request.headers.get("content-type") ?? "";
    const raw = await request.text();
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const action = body.action as string;
  const supabase = createServerClient();

  if (action === "start") {
    const userName = body.userName as string;
    if (!userName) {
      return NextResponse.json({ error: "userName required" }, { status: 400 });
    }

    // Close stale open sessions for this user (last_heartbeat > 20min ago)
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MIN * 60 * 1000).toISOString();
    await supabase
      .from("user_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("user_name", userName)
      .is("ended_at", null)
      .lt("last_heartbeat_at", staleThreshold);

    // Insert new session
    const { data, error } = await supabase
      .from("user_sessions")
      .insert({ user_name: userName })
      .select("id")
      .single();

    if (error) {
      console.error("[Session] start error:", error);
      return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
    }

    return NextResponse.json({ sessionId: data.id });
  }

  if (action === "heartbeat") {
    const sessionId = body.sessionId as string;
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      last_heartbeat_at: new Date().toISOString(),
    };

    // Increment counters by delta values
    const deltas = body.deltas as Record<string, number> | undefined;
    if (deltas) {
      // Use raw SQL increment via RPC or just set absolute values
      // For simplicity, fetch current + add deltas
      const { data: current } = await supabase
        .from("user_sessions")
        .select("search_count, export_count, company_view_count, triage_count")
        .eq("id", sessionId)
        .single();

      if (current) {
        updates.search_count = (current.search_count ?? 0) + (deltas.search ?? 0);
        updates.export_count = (current.export_count ?? 0) + (deltas.export ?? 0);
        updates.company_view_count = (current.company_view_count ?? 0) + (deltas.companyView ?? 0);
        updates.triage_count = (current.triage_count ?? 0) + (deltas.triage ?? 0);
      }
    }

    const { error } = await supabase
      .from("user_sessions")
      .update(updates)
      .eq("id", sessionId);

    if (error) {
      console.error("[Session] heartbeat error:", error);
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "end") {
    const sessionId = body.sessionId as string;
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      ended_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    };

    // Apply final count deltas
    const deltas = body.deltas as Record<string, number> | undefined;
    if (deltas) {
      const { data: current } = await supabase
        .from("user_sessions")
        .select("search_count, export_count, company_view_count, triage_count")
        .eq("id", sessionId)
        .single();

      if (current) {
        updates.search_count = (current.search_count ?? 0) + (deltas.search ?? 0);
        updates.export_count = (current.export_count ?? 0) + (deltas.export ?? 0);
        updates.company_view_count = (current.company_view_count ?? 0) + (deltas.companyView ?? 0);
        updates.triage_count = (current.triage_count ?? 0) + (deltas.triage ?? 0);
      }
    }

    const { error } = await supabase
      .from("user_sessions")
      .update(updates)
      .eq("id", sessionId);

    if (error) {
      console.error("[Session] end error:", error);
      return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
