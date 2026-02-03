import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { domains, reason, userName } = await request.json();
    if (!Array.isArray(domains) || !userName) {
      return NextResponse.json({ error: "domains[] and userName required" }, { status: 400 });
    }

    const sb = createServerClient();
    const now = new Date().toISOString();

    // Mark companies as excluded
    const { error: companyErr } = await sb
      .from("companies")
      .update({ excluded: true, excluded_by: userName, excluded_at: now, exclusion_reason: reason ?? null })
      .in("domain", domains);

    if (companyErr) console.error("Bulk exclude companies error:", companyErr);

    // Add exclusion entries
    const rows = domains.map((d: string) => ({
      type: "domain",
      value: d,
      reason: reason ?? null,
      added_by: userName,
      source: "manual",
    }));
    const { error: exclErr } = await sb.from("exclusions").insert(rows);
    if (exclErr) console.error("Bulk exclusion insert error:", exclErr);

    return NextResponse.json({ ok: true, count: domains.length });
  } catch (err) {
    console.error("POST /api/bulk/exclude error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
