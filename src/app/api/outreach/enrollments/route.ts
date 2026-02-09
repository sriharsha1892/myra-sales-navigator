import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { OutreachEnrollment, SequenceStep } from "@/lib/navigator/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): OutreachEnrollment {
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
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    let query = supabase
      .from("outreach_enrollments")
      .select("*")
      .order("created_at", { ascending: false });

    const contactId = request.nextUrl.searchParams.get("contactId");
    if (contactId) {
      query = query.eq("contact_id", contactId);
    }

    const status = request.nextUrl.searchParams.get("status");
    if (status) {
      query = query.eq("status", status);
    }

    const dueBy = request.nextUrl.searchParams.get("dueBy");
    if (dueBy) {
      query = query.lte("next_step_due_at", dueBy).eq("status", "active");
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error("[Enrollments] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch enrollments" }, { status: 500 });
    }

    return NextResponse.json({ enrollments: (data ?? []).map(mapRow) });
  } catch (err) {
    console.error("[Enrollments] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch enrollments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    sequenceId?: string;
    contactId?: string;
    companyDomain?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.sequenceId || !body.contactId || !body.companyDomain) {
    return NextResponse.json(
      { error: "Missing required fields: sequenceId, contactId, companyDomain" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerClient();

    // Fetch the sequence to get steps for calculating nextStepDueAt
    const { data: sequence, error: seqErr } = await supabase
      .from("outreach_sequences")
      .select("steps")
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

    // Check if contact is already enrolled in this sequence (active/paused)
    const { data: existingEnrollment } = await supabase
      .from("outreach_enrollments")
      .select("id, status")
      .eq("sequence_id", body.sequenceId)
      .eq("contact_id", body.contactId)
      .in("status", ["active", "paused"])
      .limit(1);

    if (existingEnrollment && existingEnrollment.length > 0) {
      const activeStatus = existingEnrollment[0].status;
      return NextResponse.json(
        {
          error: `Contact already has an ${activeStatus} enrollment in this sequence`,
          enrollmentId: existingEnrollment[0].id,
          status: activeStatus,
        },
        { status: 409 }
      );
    }

    // Calculate next step due date based on first step's delayDays
    const firstStepDelay = steps[0].delayDays ?? 0;
    const nextStepDueAt = new Date();
    nextStepDueAt.setDate(nextStepDueAt.getDate() + firstStepDelay);

    const now = new Date().toISOString();
    const { data: enrollment, error: insertErr } = await supabase
      .from("outreach_enrollments")
      .insert({
        sequence_id: body.sequenceId,
        contact_id: body.contactId,
        company_domain: body.companyDomain,
        enrolled_by: userName,
        current_step: 0,
        status: "active",
        next_step_due_at: nextStepDueAt.toISOString(),
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[Enrollments] POST error:", insertErr);
      return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
    }

    // Create the first step log entry as pending
    await supabase.from("outreach_step_logs").insert({
      enrollment_id: enrollment.id,
      step_index: 0,
      channel: steps[0].channel,
      status: "pending",
    });

    // Fire-and-forget: create Freshsales task for the first step
    (async () => {
      try {
        const { getCached, CacheKeys } = await import("@/lib/cache");
        const { isFreshsalesAvailable, createFreshsalesTask } = await import(
          "@/lib/navigator/providers/freshsales"
        );
        if (!isFreshsalesAvailable()) return;
        const intel = await getCached<import("@/lib/navigator/types").FreshsalesIntel>(
          CacheKeys.freshsales(body.companyDomain!)
        );
        if (!intel?.account?.id) return;

        // Resolve contact name from cache
        let contactName = body.contactId!;
        const cached = await getCached<{ contacts: import("@/lib/navigator/types").Contact[] }>(
          CacheKeys.enrichedContacts(body.companyDomain!)
        );
        if (cached?.contacts) {
          const match = cached.contacts.find((c) => c.id === body.contactId);
          if (match) contactName = `${match.firstName} ${match.lastName}`.trim() || contactName;
        }

        // Fetch sequence name
        const { data: seq } = await supabase
          .from("outreach_sequences")
          .select("name")
          .eq("id", body.sequenceId!)
          .single();

        await createFreshsalesTask({
          title: `Follow up: ${seq?.name ?? "Sequence"} — ${contactName}`,
          description: "Sequence enrolled via myRA Navigator",
          dueDate: nextStepDueAt.toISOString(),
          targetableType: "SalesAccount",
          targetableId: intel.account.id,
        });
        console.log(`[CRM Sync] Task created for ${contactName} at ${body.companyDomain}`);
      } catch {
        // Silent — CRM sync is best-effort
      }
    })();

    return NextResponse.json(mapRow(enrollment), { status: 201 });
  } catch (err) {
    console.error("[Enrollments] POST error:", err);
    return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
  }
}
