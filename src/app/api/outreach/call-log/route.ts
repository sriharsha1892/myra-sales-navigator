import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { CallLog } from "@/lib/navigator/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): CallLog {
  return {
    id: row.id,
    contactId: row.contact_id,
    companyDomain: row.company_domain,
    userName: row.user_name,
    outcome: row.outcome,
    notes: row.notes ?? null,
    durationSeconds: row.duration_seconds ?? null,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const VALID_OUTCOMES = ["connected", "voicemail", "no_answer", "busy", "wrong_number"];

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    contactId?: string;
    companyDomain?: string;
    outcome?: string;
    notes?: string;
    durationSeconds?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.contactId || !body.companyDomain || !body.outcome) {
    return NextResponse.json(
      { error: "Missing required fields: contactId, companyDomain, outcome" },
      { status: 400 }
    );
  }

  if (!VALID_OUTCOMES.includes(body.outcome)) {
    return NextResponse.json(
      { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}` },
      { status: 400 }
    );
  }

  if (body.durationSeconds !== undefined && body.durationSeconds !== null) {
    if (typeof body.durationSeconds !== "number" || body.durationSeconds < 0 || isNaN(body.durationSeconds)) {
      return NextResponse.json(
        { error: "durationSeconds must be a non-negative number" },
        { status: 400 }
      );
    }
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("call_logs")
      .insert({
        contact_id: body.contactId,
        company_domain: body.companyDomain,
        user_name: userName,
        outcome: body.outcome,
        notes: body.notes ?? null,
        duration_seconds: body.durationSeconds ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[CallLog] POST error:", error);
      return NextResponse.json({ error: "Failed to create call log" }, { status: 500 });
    }

    return NextResponse.json(mapRow(data), { status: 201 });
  } catch (err) {
    console.error("[CallLog] POST error:", err);
    return NextResponse.json({ error: "Failed to create call log" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get("contactId");
  if (!contactId) {
    return NextResponse.json({ error: "contactId query parameter is required" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("call_logs")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[CallLog] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch call logs" }, { status: 500 });
    }

    return NextResponse.json({ callLogs: (data ?? []).map(mapRow) });
  } catch (err) {
    console.error("[CallLog] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch call logs" }, { status: 500 });
  }
}
