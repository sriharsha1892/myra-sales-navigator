import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { SequenceStep } from "@/lib/navigator/types";

interface BulkContact {
  contactId: string;
  companyDomain: string;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    sequenceId?: string;
    contacts?: BulkContact[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.sequenceId) {
    return NextResponse.json(
      { error: "Missing required field: sequenceId" },
      { status: 400 }
    );
  }

  if (!body.contacts || !Array.isArray(body.contacts) || body.contacts.length === 0) {
    return NextResponse.json(
      { error: "contacts must be a non-empty array" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient();

    // Fetch the sequence to validate it exists and get steps
    const { data: sequence, error: seqErr } = await supabase
      .from("outreach_sequences")
      .select("id, steps")
      .eq("id", body.sequenceId)
      .single();

    if (seqErr || !sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const steps: SequenceStep[] =
      typeof sequence.steps === "string"
        ? JSON.parse(sequence.steps)
        : sequence.steps ?? [];

    if (steps.length === 0) {
      return NextResponse.json(
        { error: "Sequence has no steps" },
        { status: 400 }
      );
    }

    // Check which contacts are already enrolled (active, paused, or completed) in this sequence
    const contactIds = body.contacts.map((c) => c.contactId);
    const { data: existingEnrollments } = await supabase
      .from("outreach_enrollments")
      .select("contact_id")
      .eq("sequence_id", body.sequenceId)
      .in("contact_id", contactIds)
      .in("status", ["active", "paused", "completed"]);

    const alreadyEnrolledIds = new Set(
      (existingEnrollments ?? []).map((e) => e.contact_id as string)
    );

    // Filter to only contacts not already enrolled
    const toEnroll = body.contacts.filter(
      (c) => !alreadyEnrolledIds.has(c.contactId)
    );
    const skipped = body.contacts.length - toEnroll.length;

    if (toEnroll.length === 0) {
      return NextResponse.json({
        enrolled: 0,
        skipped,
        errors: [],
        message: "All contacts are already enrolled in this sequence",
      });
    }

    // Calculate next step due date based on first step's delayDays
    const firstStepDelay = steps[0].delayDays ?? 0;
    const now = new Date();
    const nextStepDueAt = new Date(now);
    nextStepDueAt.setDate(nextStepDueAt.getDate() + firstStepDelay);

    const nowIso = now.toISOString();
    const nextStepDueAtIso = nextStepDueAt.toISOString();

    // Batch insert enrollments
    const enrollmentRows = toEnroll.map((c) => ({
      sequence_id: body.sequenceId!,
      contact_id: c.contactId,
      company_domain: c.companyDomain,
      enrolled_by: userName,
      current_step: 0,
      status: "active",
      next_step_due_at: nextStepDueAtIso,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const errors: string[] = [];
    let enrolledCount = 0;

    // Insert in batches of 50 to avoid hitting limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < enrollmentRows.length; i += BATCH_SIZE) {
      const batch = enrollmentRows.slice(i, i + BATCH_SIZE);
      const { data: inserted, error: insertErr } = await supabase
        .from("outreach_enrollments")
        .insert(batch)
        .select("id, contact_id");

      if (insertErr) {
        console.error("[BulkEnroll] Batch insert error:", insertErr);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertErr.message}`);
        continue;
      }

      enrolledCount += (inserted ?? []).length;

      // Create first step log entries for each enrollment
      if (inserted && inserted.length > 0) {
        const stepLogRows = inserted.map((enrollment) => ({
          enrollment_id: enrollment.id,
          step_index: 0,
          channel: steps[0].channel,
          status: "pending",
        }));

        const { error: stepLogErr } = await supabase
          .from("outreach_step_logs")
          .insert(stepLogRows);

        if (stepLogErr) {
          console.error("[BulkEnroll] Step log insert error:", stepLogErr);
          // Non-fatal — enrollments are already created
        }
      }
    }

    return NextResponse.json({
      enrolled: enrolledCount,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("[BulkEnroll] POST error:", err);
    return NextResponse.json({ error: "Bulk enrollment failed" }, { status: 500 });
  }
}
