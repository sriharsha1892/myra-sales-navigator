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

    // Check which domains are already excluded
    const { data: existing } = await sb
      .from("exclusions")
      .select("value")
      .eq("type", "domain")
      .in("value", domains);

    const alreadyExcludedSet = new Set((existing ?? []).map((r: { value: string }) => r.value));
    const newDomains = (domains as string[]).filter((d) => !alreadyExcludedSet.has(d));

    // Mark companies as excluded (all domains — idempotent update)
    const { error: companyErr } = await sb
      .from("companies")
      .update({ excluded: true, excluded_by: userName, excluded_at: now, exclusion_reason: reason ?? null })
      .in("domain", domains);

    if (companyErr) console.error("Bulk exclude companies error:", companyErr);

    // Insert only new exclusion entries
    if (newDomains.length > 0) {
      const rows = newDomains.map((d) => ({
        type: "domain",
        value: d,
        reason: reason ?? null,
        added_by: userName,
        source: "manual",
      }));
      const { error: exclErr } = await sb.from("exclusions").insert(rows);
      if (exclErr) console.error("Bulk exclusion insert error:", exclErr);
    }

    return NextResponse.json({
      ok: true,
      excluded: newDomains.length,
      alreadyExcluded: alreadyExcludedSet.size,
    });
  } catch (err) {
    console.error("POST /api/bulk/exclude error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
