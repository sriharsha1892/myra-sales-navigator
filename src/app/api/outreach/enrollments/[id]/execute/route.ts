import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { SequenceStep, OutreachEnrollment, OutreachStepLog, Contact, CompanyEnriched, Signal } from "@/lib/navigator/types";

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

export async function POST(
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
    outcome?: string;
    notes?: string;
    draftContent?: string;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const supabase = createServerClient();

    // Fetch enrollment
    const { data: enrollment, error: enrollErr } = await supabase
      .from("outreach_enrollments")
      .select("*")
      .eq("id", id)
      .single();

    if (enrollErr || !enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    if (enrollment.status !== "active") {
      return NextResponse.json(
        { error: "Can only execute steps on active enrollments" },
        { status: 400 }
      );
    }

    // Fetch sequence for step definitions
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

    if (currentStepIndex >= steps.length) {
      return NextResponse.json({ error: "No more steps to execute" }, { status: 400 });
    }

    const currentStep = steps[currentStepIndex];
    const now = new Date().toISOString();

    // CR1: Resolve contact name from KV cache instead of passing UUID
    let contactName = enrollment.contact_id; // fallback to ID
    let contactLinkedinUrl: string | null = null;
    let contactFreshsalesId: string | null = null;
    let contactPhone: string | null = null;

    try {
      const { getCached, CacheKeys } = await import("@/lib/cache");
      const cached = await getCached<{ contacts: Contact[]; sources: Record<string, boolean> }>(
        CacheKeys.enrichedContacts(enrollment.company_domain)
      );
      if (cached?.contacts) {
        const match = cached.contacts.find((c) => c.id === enrollment.contact_id);
        if (match) {
          contactName = `${match.firstName} ${match.lastName}`.trim() || contactName;
          contactLinkedinUrl = match.linkedinUrl ?? null;
          contactFreshsalesId = match.freshsalesOwnerId ? String(match.freshsalesOwnerId) : null;
          contactPhone = match.phone ?? null;
        }
      }
    } catch {
      // Cache lookup failed, continue with fallback
    }

    // Resolve company data from cache for draft context
    let contactTitle = "";
    let contactSeniority = "";
    let companyIndustry = "";
    let companySignals: Signal[] = [];
    let hubspotStatus = "none";
    let freshsalesStatus = "none";
    let icpScore: number | undefined;

    // Get contact details from the cache match
    try {
      const { getCached: getCachedCompany, CacheKeys: CompanyCacheKeys } = await import("@/lib/cache");
      const cached = await getCachedCompany<{ contacts: Contact[] }>(
        CompanyCacheKeys.enrichedContacts(enrollment.company_domain)
      );
      if (cached?.contacts) {
        const match = cached.contacts.find((c) => c.id === enrollment.contact_id);
        if (match) {
          contactTitle = match.title || "";
          contactSeniority = match.seniority || "";
        }
      }

      // Get company data from KV cache
      const companyData = await getCachedCompany<CompanyEnriched>(
        CompanyCacheKeys.company(enrollment.company_domain)
      );
      if (companyData) {
        companyIndustry = companyData.industry || "";
        companySignals = companyData.signals || [];
        hubspotStatus = companyData.hubspotStatus || "none";
        freshsalesStatus = companyData.freshsalesStatus || "none";
        icpScore = companyData.icpScore;
      }
    } catch { /* silent */ }

    let executionResult: Record<string, unknown> = {};

    // Channel-specific execution logic
    if (currentStep.channel === "email") {
      // For email steps: generate draft via LLM by calling internal API
      // Build the draft request for the internal outreach/draft endpoint
      try {
        const origin = request.nextUrl.origin;
        const draftResponse = await fetch(`${origin}/api/outreach/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: contactName,
            companyName: enrollment.company_domain,
            tone: currentStep.tone ?? "formal",
            channel: "email",
            template: currentStep.template ?? "intro",
            contactTitle,
            contactSeniority,
            companyIndustry,
            signals: companySignals,
            hubspotStatus,
            freshsalesStatus,
            icpScore,
          }),
        });

        if (draftResponse.ok) {
          const draft = await draftResponse.json();
          executionResult = {
            type: "email_draft",
            subject: draft.subject ?? null,
            message: draft.message ?? null,
          };
        } else {
          executionResult = {
            type: "email_draft",
            error: "Draft generation failed — complete manually",
          };
        }
      } catch (draftErr) {
        console.warn("[Execute] Email draft generation failed:", draftErr);
        executionResult = {
          type: "email_draft",
          error: "Draft generation failed — complete manually",
        };
      }
    } else if (currentStep.channel === "call") {
      // For call steps: return talking points and Freshsales deep-link
      // Check if user has Freshsales domain configured
      const { data: userConfig } = await supabase
        .from("user_config")
        .select("freshsales_domain")
        .eq("user_name", userName)
        .single();

      const freshsalesDomain = userConfig?.freshsales_domain;
      let deepLink: string | null = null;
      if (freshsalesDomain) {
        deepLink = contactFreshsalesId
          ? `https://${freshsalesDomain}.freshsales.io/contacts/${contactFreshsalesId}`
          : `https://${freshsalesDomain}.freshsales.io/search?q=${encodeURIComponent(contactName !== enrollment.contact_id ? contactName : enrollment.company_domain)}`;
      }

      executionResult = {
        type: "call",
        talkingPoints: currentStep.notes ?? "Review company dossier before calling.",
        freshsalesUrl: deepLink,
        contactId: enrollment.contact_id,
        companyDomain: enrollment.company_domain,
      };
    } else if (
      currentStep.channel === "linkedin_connect" ||
      currentStep.channel === "linkedin_inmail"
    ) {
      // For LinkedIn steps: return contact's LinkedIn URL + draft note
      // Try to generate a connection note via LLM
      let draftNote: string | null = null;
      try {
        const origin = request.nextUrl.origin;
        const draftResponse = await fetch(`${origin}/api/outreach/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: contactName,
            companyName: enrollment.company_domain,
            tone: currentStep.tone ?? "casual",
            channel: currentStep.channel,
            template: currentStep.template ?? "intro",
            contactTitle,
            contactSeniority,
            companyIndustry,
            signals: companySignals,
            hubspotStatus,
            freshsalesStatus,
            icpScore,
          }),
        });

        if (draftResponse.ok) {
          const draft = await draftResponse.json();
          draftNote = draft.message ?? null;
        }
      } catch {
        // Graceful fallback
      }

      executionResult = {
        type: "linkedin",
        channel: currentStep.channel,
        draftNote,
        contactId: enrollment.contact_id,
        contactName,
        linkedinUrl: contactLinkedinUrl,
        companyDomain: enrollment.company_domain,
      };
    } else if (currentStep.channel === "whatsapp") {
      // For WhatsApp: generate a short message draft
      let draftMessage: string | null = null;
      try {
        const origin = request.nextUrl.origin;
        const draftResponse = await fetch(`${origin}/api/outreach/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: contactName,
            companyName: enrollment.company_domain,
            tone: currentStep.tone ?? "casual",
            channel: "whatsapp",
            template: currentStep.template ?? "intro",
            contactTitle,
            contactSeniority,
            companyIndustry,
            signals: companySignals,
            hubspotStatus,
            freshsalesStatus,
            icpScore,
          }),
        });

        if (draftResponse.ok) {
          const draft = await draftResponse.json();
          draftMessage = draft.message ?? null;
        }
      } catch {
        // Graceful fallback
      }

      executionResult = {
        type: "whatsapp",
        draftMessage,
        contactId: enrollment.contact_id,
      };
    }

    // Mark current step log as completed
    const draftContent =
      body.draftContent ??
      (executionResult as Record<string, unknown>).message ??
      (executionResult as Record<string, unknown>).draftNote ??
      (executionResult as Record<string, unknown>).draftMessage ??
      null;

    await supabase
      .from("outreach_step_logs")
      .update({
        status: "completed",
        completed_at: now,
        outcome: body.outcome ?? null,
        notes: body.notes ?? null,
        draft_content: typeof draftContent === "string" ? draftContent : null,
      })
      .eq("enrollment_id", id)
      .eq("step_index", currentStepIndex)
      .eq("status", "pending");

    // Advance to next step
    const nextStepIndex = currentStepIndex + 1;

    let updatedEnrollment: OutreachEnrollment;
    let completed = false;

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
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Failed to complete enrollment" }, { status: 500 });
      }
      updatedEnrollment = mapEnrollmentRow(data);
      completed = true;
    } else {
      // Advance to next step
      const nextStep = steps[nextStepIndex];
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + (nextStep.delayDays ?? 0));

      // Create next step log
      await supabase.from("outreach_step_logs").insert({
        enrollment_id: id,
        step_index: nextStepIndex,
        channel: nextStep.channel,
        status: "pending",
      });

      const { data, error } = await supabase
        .from("outreach_enrollments")
        .update({
          current_step: nextStepIndex,
          next_step_due_at: nextDue.toISOString(),
          updated_at: now,
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Failed to advance enrollment" }, { status: 500 });
      }
      updatedEnrollment = mapEnrollmentRow(data);
    }

    // Fire-and-forget: sync activity to Freshsales CRM
    (async () => {
      try {
        const { getCached, CacheKeys } = await import("@/lib/cache");
        const { isFreshsalesAvailable, createFreshsalesActivity } = await import(
          "@/lib/navigator/providers/freshsales"
        );
        if (!isFreshsalesAvailable()) return;
        const intel = await getCached<import("@/lib/navigator/types").FreshsalesIntel>(
          CacheKeys.freshsales(enrollment.company_domain)
        );
        if (!intel?.account?.id) return;
        await createFreshsalesActivity({
          title: `Outreach: ${currentStep.channel} step completed`,
          notes: typeof draftContent === "string" ? draftContent.slice(0, 500) : "",
          targetableType: "SalesAccount",
          targetableId: intel.account.id,
        });
        console.log(`[CRM Sync] Activity created for ${contactName} at ${enrollment.company_domain}`);
      } catch {
        // Silent — CRM sync is best-effort
      }
    })();

    // Fetch updated step logs
    const { data: allStepLogs } = await supabase
      .from("outreach_step_logs")
      .select("*")
      .eq("enrollment_id", id)
      .order("step_index", { ascending: true });

    return NextResponse.json({
      enrollment: updatedEnrollment,
      stepLogs: (allStepLogs ?? []).map(mapStepLogRow),
      executionResult,
      completed,
    });
  } catch (err) {
    console.error("[Execute] Error:", err);
    return NextResponse.json({ error: "Failed to execute step" }, { status: 500 });
  }
}
