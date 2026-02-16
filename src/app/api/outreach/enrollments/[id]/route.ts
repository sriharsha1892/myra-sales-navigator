import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { OutreachEnrollment, OutreachStepLog, SequenceStep } from "@/lib/navigator/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEnrollmentRow(row: any): OutreachEnrollment {
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    contactId: row.contact_id,
    companyDomain: row.company_domain,
    enrolledBy: row.enrolled_by,
    currentStep: row.current_step ?? 0,
    status: row.status ?? "active",
    nextStepDueAt: row.next_step_due_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStepLogRow(row: any): OutreachStepLog {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    stepIndex: row.step_index,
    channel: row.channel,
    status: row.status,
    completedAt: row.completed_at ?? null,
    outcome: row.outcome ?? null,
    notes: row.notes ?? null,
    draftContent: row.draft_content ?? null,
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

    const { data: enrollment, error: enrollErr } = await supabase
      .from("outreach_enrollments")
      .select("*")
      .eq("id", id)
      .single();

    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const { data: stepLogs } = await supabase
      .from("outreach_step_logs")
      .select("*")
      .eq("enrollment_id", id)
      .order("step_index", { ascending: true });

    return NextResponse.json({
      enrollment: mapEnrollmentRow(enrollment),
      stepLogs: (stepLogs ?? []).map(mapStepLogRow),
    });
  } catch (err) {
    console.error("[Enrollments] GET by id error:", err);
    return NextResponse.json({ error: "Failed to fetch enrollment" }, { status: 500 });
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
    action?: "pause" | "resume" | "unenroll" | "advance";
    outcome?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ error: "Missing required field: action" }, { status: 400 });
  }

  const validActions = ["pause", "resume", "unenroll", "advance"];
  if (!validActions.includes(body.action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient();

    // Fetch current enrollment
    const { data: enrollment, error: fetchErr } = await supabase
      .from("outreach_enrollments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (body.action === "pause") {
      if (enrollment.status !== "active") {
        return NextResponse.json({ error: "Can only pause active enrollments" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("outreach_enrollments")
        .update({ status: "paused", next_step_due_at: null, updated_at: now })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to pause enrollment" }, { status: 500 });
      }

      // Cancel any pending step logs so in-flight executions can't complete
      await supabase
        .from("outreach_step_logs")
        .update({ status: "cancelled", notes: "Enrollment paused" })
        .eq("enrollment_id", id)
        .eq("status", "pending");

      return NextResponse.json({ enrollment: mapEnrollmentRow(data) });
    }

    if (body.action === "resume") {
      if (enrollment.status !== "paused") {
        return NextResponse.json({ error: "Can only resume paused enrollments" }, { status: 400 });
      }

      // Fetch sequence to recalculate next_step_due_at from now
      const { data: seq } = await supabase
        .from("outreach_sequences")
        .select("steps")
        .eq("id", enrollment.sequence_id)
        .single();

      const resumeSteps: SequenceStep[] = seq
        ? typeof seq.steps === "string" ? JSON.parse(seq.steps) : seq.steps ?? []
        : [];
      const stepIdx: number = enrollment.current_step ?? 0;
      let nextStepDueAt: string | null = null;
      if (stepIdx < resumeSteps.length) {
        const nextDue = new Date();
        nextDue.setDate(nextDue.getDate() + (resumeSteps[stepIdx].delayDays ?? 0));
        nextStepDueAt = nextDue.toISOString();
      }

      const { data, error } = await supabase
        .from("outreach_enrollments")
        .update({ status: "active", next_step_due_at: nextStepDueAt, updated_at: now })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to resume enrollment" }, { status: 500 });
      }

      // Re-create pending step log if it was cancelled during pause
      if (stepIdx < resumeSteps.length) {
        const { data: existingLog } = await supabase
          .from("outreach_step_logs")
          .select("id")
          .eq("enrollment_id", id)
          .eq("step_index", stepIdx)
          .eq("status", "pending")
          .limit(1);

        if (!existingLog || existingLog.length === 0) {
          await supabase.from("outreach_step_logs").insert({
            enrollment_id: id,
            step_index: stepIdx,
            channel: resumeSteps[stepIdx].channel,
            status: "pending",
          });
        }
      }

      return NextResponse.json({ enrollment: mapEnrollmentRow(data) });
    }

    if (body.action === "unenroll") {
      if (enrollment.status === "completed" || enrollment.status === "unenrolled") {
        return NextResponse.json({ error: "Enrollment is already finished" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("outreach_enrollments")
        .update({ status: "unenrolled", next_step_due_at: null, updated_at: now })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to unenroll" }, { status: 500 });
      }

      // Cancel any pending step logs
      await supabase
        .from("outreach_step_logs")
        .update({ status: "cancelled", notes: "Enrollment unenrolled" })
        .eq("enrollment_id", id)
        .eq("status", "pending");

      return NextResponse.json({ enrollment: mapEnrollmentRow(data) });
    }

    // action === "advance"
    if (enrollment.status !== "active") {
      return NextResponse.json({ error: "Can only advance active enrollments" }, { status: 400 });
    }

    // Fetch the sequence to get steps
    const { data: sequence, error: seqErr } = await supabase
      .from("outreach_sequences")
      .select("steps")
      .eq("id", enrollment.sequence_id)
      .single();

    if (seqErr || !sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 500 });
    }

    const steps: SequenceStep[] =
      typeof sequence.steps === "string"
        ? JSON.parse(sequence.steps)
        : sequence.steps ?? [];

    const currentStepIndex: number = enrollment.current_step ?? 0;

    // Mark current step log as completed
    const { error: stepLogErr } = await supabase
      .from("outreach_step_logs")
      .update({
        status: "completed",
        completed_at: now,
        outcome: body.outcome ?? null,
        notes: body.notes ?? null,
      })
      .eq("enrollment_id", id)
      .eq("step_index", currentStepIndex)
      .eq("status", "pending");

    if (stepLogErr) {
      return NextResponse.json({ error: "Failed to update step log" }, { status: 500 });
    }

    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex >= steps.length) {
      // Sequence complete
      const { data, error } = await supabase
        .from("outreach_enrollments")
        .update({
          current_step: nextStepIndex,
          status: "completed",
          next_step_due_at: null,
          updated_at: now,
        })
        .eq("id", id)
        .eq("status", "active")
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to complete enrollment" }, { status: 500 });
      }
      return NextResponse.json({ enrollment: mapEnrollmentRow(data), completed: true });
    }

    // Calculate next step due date
    const nextStep = steps[nextStepIndex];
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + (nextStep.delayDays ?? 0));

    // Create next step log
    const { error: nextLogErr } = await supabase.from("outreach_step_logs").insert({
      enrollment_id: id,
      step_index: nextStepIndex,
      channel: nextStep.channel,
      status: "pending",
    });

    if (nextLogErr) {
      return NextResponse.json({ error: "Failed to create next step log" }, { status: 500 });
    }

    // Update enrollment (status guard prevents advancing paused/unenrolled)
    const { data, error } = await supabase
      .from("outreach_enrollments")
      .update({
        current_step: nextStepIndex,
        next_step_due_at: nextDue.toISOString(),
        updated_at: now,
      })
      .eq("id", id)
      .eq("status", "active")
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to advance enrollment" }, { status: 500 });
    }

    return NextResponse.json({ enrollment: mapEnrollmentRow(data), completed: false });
  } catch (err) {
    console.error("[Enrollments] PUT error:", err);
    return NextResponse.json({ error: "Failed to update enrollment" }, { status: 500 });
  }
}
