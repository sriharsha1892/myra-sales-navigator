import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { OutreachSequence, SequenceStep } from "@/lib/navigator/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): OutreachSequence {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    createdBy: row.created_by,
    isTemplate: row.is_template ?? false,
    steps: (typeof row.steps === "string" ? JSON.parse(row.steps) : row.steps) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    let query = supabase
      .from("outreach_sequences")
      .select("*")
      .order("created_at", { ascending: false });

    const createdBy = request.nextUrl.searchParams.get("createdBy");
    if (createdBy) {
      query = query.eq("created_by", createdBy);
    }

    const isTemplate = request.nextUrl.searchParams.get("isTemplate");
    if (isTemplate === "true") {
      query = query.eq("is_template", true);
    } else if (isTemplate === "false") {
      query = query.eq("is_template", false);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Sequences] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch sequences" }, { status: 500 });
    }

    return NextResponse.json({ sequences: (data ?? []).map(mapRow) });
  } catch (err) {
    console.error("[Sequences] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch sequences" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    name?: string;
    description?: string;
    isTemplate?: boolean;
    steps?: SequenceStep[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
  }

  if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json(
      { error: "steps must be a non-empty array" },
      { status: 400 }
    );
  }

  const VALID_CHANNELS = ["email", "call", "linkedin_connect", "linkedin_inmail", "whatsapp"];
  for (const step of body.steps) {
    if (!VALID_CHANNELS.includes(step.channel)) {
      return NextResponse.json(
        { error: `Invalid channel "${step.channel}". Must be one of: ${VALID_CHANNELS.join(", ")}` },
        { status: 400 }
      );
    }
    if (step.delayDays !== undefined && (typeof step.delayDays !== "number" || step.delayDays < 0)) {
      return NextResponse.json(
        { error: "delayDays must be a non-negative number" },
        { status: 400 }
      );
    }
  }

  try {
    const supabase = createServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("outreach_sequences")
      .insert({
        name: body.name,
        description: body.description ?? null,
        created_by: userName,
        is_template: body.isTemplate ?? false,
        steps: JSON.stringify(body.steps),
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error("[Sequences] POST error:", error);
      return NextResponse.json({ error: "Failed to create sequence" }, { status: 500 });
    }

    return NextResponse.json(mapRow(data), { status: 201 });
  } catch (err) {
    console.error("[Sequences] POST error:", err);
    return NextResponse.json({ error: "Failed to create sequence" }, { status: 500 });
  }
}
