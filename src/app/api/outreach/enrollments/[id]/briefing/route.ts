import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCached, CacheKeys } from "@/lib/cache";
import type { Contact, CompanyEnriched, FreshsalesIntel, BriefingData } from "@/lib/navigator/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // 1. Fetch enrollment
  const { data: enrollment, error } = await supabase
    .from("outreach_enrollments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  // 2. Parallel data fetch from caches
  const [contactsCache, companyCache, freshsalesCache, stepsRes] = await Promise.allSettled([
    getCached<{ contacts: Contact[] }>(CacheKeys.enrichedContacts(enrollment.company_domain)),
    getCached<CompanyEnriched>(CacheKeys.company(enrollment.company_domain)),
    getCached<FreshsalesIntel>(CacheKeys.freshsales(enrollment.company_domain)),
    supabase
      .from("outreach_step_logs")
      .select("channel, completed_at, outcome, status")
      .eq("enrollment_id", id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(5),
  ]);

  // 3. Resolve contact
  let contact: BriefingData["contact"] = {
    name: "", title: "", seniority: "", phone: null, linkedinUrl: null, emailConfidence: 0,
  };
  if (contactsCache.status === "fulfilled" && contactsCache.value?.contacts) {
    const match = contactsCache.value.contacts.find((c) => c.id === enrollment.contact_id);
    if (match) {
      contact = {
        name: `${match.firstName} ${match.lastName}`.trim(),
        title: match.title || "",
        seniority: match.seniority || "",
        phone: match.phone ?? null,
        linkedinUrl: match.linkedinUrl ?? null,
        emailConfidence: match.emailConfidence ?? 0,
      };
    }
  }

  // 4. Resolve company
  let company: BriefingData["company"] = {
    name: enrollment.company_domain, domain: enrollment.company_domain,
    industry: "", employeeCount: 0, location: "", icpScore: 0, icpReasoning: null,
  };
  if (companyCache.status === "fulfilled" && companyCache.value) {
    const c = companyCache.value;
    company = {
      name: c.name || enrollment.company_domain,
      domain: c.domain,
      industry: c.industry || "",
      employeeCount: c.employeeCount ?? 0,
      location: c.location || "",
      icpScore: c.icpScore ?? 0,
      icpReasoning: c.nlIcpReasoning ?? null,
    };
  }

  // 5. Resolve CRM
  let crm: BriefingData["crm"] = {
    status: "none", warmth: "cold", lastContactDate: null, topDeal: null, lastActivity: null,
  };
  if (freshsalesCache.status === "fulfilled" && freshsalesCache.value) {
    const fs = freshsalesCache.value;
    crm.status = fs.status;
    crm.lastContactDate = fs.lastContactDate;

    if (fs.deals?.length > 0) {
      const d = fs.deals[0];
      crm.topDeal = { name: d.name, stage: d.stage, amount: d.amount, daysInStage: d.daysInStage };
    }
    if (fs.recentActivity?.length > 0) {
      const a = fs.recentActivity[0];
      crm.lastActivity = { type: a.type, date: a.date, actor: a.actor };
    }

    // Derive warmth
    const lastContactDays = fs.lastContactDate
      ? Math.floor((Date.now() - new Date(fs.lastContactDate).getTime()) / 86400000)
      : Infinity;
    const hasOpenDeal = fs.deals?.some((d) => !["won", "lost"].includes(d.stage?.toLowerCase() ?? ""));

    if (hasOpenDeal || lastContactDays <= 14) {
      crm.warmth = "hot";
    } else if (fs.status !== "none" || lastContactDays <= 60) {
      crm.warmth = "warm";
    } else {
      crm.warmth = "cold";
    }
  }

  // 6. Top signal
  let topSignal: BriefingData["topSignal"] = null;
  if (companyCache.status === "fulfilled" && companyCache.value?.signals?.length) {
    const s = companyCache.value.signals[0];
    topSignal = { type: s.type, title: s.title, date: s.date };
  }

  // 7. Previous steps
  let previousSteps: BriefingData["previousSteps"] = [];
  if (stepsRes.status === "fulfilled" && stepsRes.value.data) {
    previousSteps = stepsRes.value.data.map((s: { channel: string; completed_at: string; outcome: string | null }) => ({
      channel: s.channel,
      completedAt: s.completed_at,
      outcome: s.outcome,
    }));
  }

  // 8. Suggested opener via Gemini
  let suggestedOpener = `Hi ${contact.name.split(" ")[0] || "there"}, I wanted to reach out about working together.`;
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const signalContext = topSignal ? `Recent signal: ${topSignal.title}.` : "";
      const warmthContext = crm.warmth === "hot" ? "This is a warm lead with an active deal." : crm.warmth === "warm" ? "This contact is in our CRM." : "This is a cold outreach.";

      const prompt = `Write a 1-sentence opener for a call to ${contact.name} (${contact.title}) at ${company.name} (${company.industry}, ${company.employeeCount} employees). ${signalContext} ${warmthContext} Be specific and human. Max 30 words.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 80 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) suggestedOpener = text;
      }
    }
  } catch { /* fallback to default */ }

  const briefing: BriefingData = {
    contact, company, crm, topSignal, previousSteps, suggestedOpener,
  };

  return NextResponse.json(briefing);
}
