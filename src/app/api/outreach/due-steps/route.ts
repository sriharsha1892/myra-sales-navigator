import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCached, CacheKeys } from "@/lib/cache";
import type { Contact } from "@/lib/navigator/types";

export async function GET() {
  try {
    const supabase = createServerClient();
    const today = new Date().toISOString().split("T")[0] + "T23:59:59.999Z";

    const { data: enrollments, error: enrollErr } = await supabase
      .from("outreach_enrollments")
      .select("*")
      .eq("status", "active")
      .lte("next_step_due_at", today)
      .order("next_step_due_at", { ascending: true })
      .limit(50);

    if (enrollErr || !enrollments || enrollments.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Batch-fetch sequences
    const seqIds = [...new Set(enrollments.map((e) => e.sequence_id))];
    const { data: sequences } = await supabase
      .from("outreach_sequences")
      .select("*")
      .in("id", seqIds);

    const seqMap = new Map(
      (sequences ?? []).map((s) => [s.id, s])
    );

    const items = enrollments
      .map((e) => {
        const seq = seqMap.get(e.sequence_id);
        const steps =
          seq
            ? typeof seq.steps === "string"
              ? JSON.parse(seq.steps)
              : seq.steps ?? []
            : [];
        return {
          enrollment: {
            id: e.id,
            sequenceId: e.sequence_id,
            contactId: e.contact_id,
            companyDomain: e.company_domain,
            enrolledBy: e.enrolled_by,
            currentStep: e.current_step ?? 0,
            status: e.status ?? "active",
            nextStepDueAt: e.next_step_due_at ?? null,
            createdAt: e.created_at,
            updatedAt: e.updated_at,
          },
          sequence: seq
            ? {
                id: seq.id,
                name: seq.name,
                description: seq.description ?? "",
                steps,
                isTemplate: seq.is_template ?? false,
                createdBy: seq.created_by ?? "",
                createdAt: seq.created_at,
              }
            : {
                id: "",
                name: "Unknown",
                description: "",
                steps: [],
                isTemplate: false,
                createdBy: "",
                createdAt: "",
              },
          contactName: e.contact_id, // resolved below
          companyName: e.company_domain, // resolved below
        };
      })
      .filter((item) => item.sequence.steps.length > 0);

    // Batch-resolve contact names from KV cache
    const uniqueDomains = [...new Set(items.map((i) => i.enrollment.companyDomain))];
    const contactCacheMap = new Map<string, Contact[]>();
    await Promise.all(
      uniqueDomains.map(async (domain) => {
        try {
          const cached = await getCached<{ contacts: Contact[]; sources: Record<string, boolean> }>(
            CacheKeys.enrichedContacts(domain)
          );
          if (cached?.contacts) contactCacheMap.set(domain, cached.contacts);
        } catch { /* silent */ }
      })
    );

    for (const item of items) {
      const contacts = contactCacheMap.get(item.enrollment.companyDomain);
      if (contacts) {
        const match = contacts.find((c) => c.id === item.enrollment.contactId);
        if (match) {
          item.contactName = `${match.firstName} ${match.lastName}`.trim() || item.contactName;
        }
      }
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[DueSteps] Error:", err);
    return NextResponse.json({ items: [] });
  }
}
