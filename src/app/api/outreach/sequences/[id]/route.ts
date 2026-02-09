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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("outreach_sequences")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    return NextResponse.json(mapRow(data));
  } catch (err) {
    console.error("[Sequences] GET by id error:", err);
    return NextResponse.json({ error: "Failed to fetch sequence" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  try {
    const supabase = createServerClient();

    // Check sequence exists
    const { data: existing, error: fetchErr } = await supabase
      .from("outreach_sequences")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.isTemplate !== undefined) updates.is_template = body.isTemplate;
    if (body.steps !== undefined) updates.steps = JSON.stringify(body.steps);

    const { data, error } = await supabase
      .from("outreach_sequences")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Sequences] PUT error:", error);
      return NextResponse.json({ error: "Failed to update sequence" }, { status: 500 });
    }

    return NextResponse.json(mapRow(data));
  } catch (err) {
    console.error("[Sequences] PUT error:", err);
    return NextResponse.json({ error: "Failed to update sequence" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const supabase = createServerClient();

    // Check for active enrollments
    const { data: activeEnrollments, error: enrollErr } = await supabase
      .from("outreach_enrollments")
      .select("id")
      .eq("sequence_id", id)
      .eq("status", "active")
      .limit(1);

    if (enrollErr) {
      console.error("[Sequences] DELETE enrollment check error:", enrollErr);
      return NextResponse.json({ error: "Failed to check enrollments" }, { status: 500 });
    }

    if (activeEnrollments && activeEnrollments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete sequence with active enrollments. Unenroll all contacts first." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("outreach_sequences")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Sequences] DELETE error:", error);
      return NextResponse.json({ error: "Failed to delete sequence" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Sequences] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete sequence" }, { status: 500 });
  }
}
