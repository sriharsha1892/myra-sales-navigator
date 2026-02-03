import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { domains, text, userName } = await request.json();
    if (!Array.isArray(domains) || !text || !userName) {
      return NextResponse.json({ error: "domains[], text, userName required" }, { status: 400 });
    }

    const sb = createServerClient();

    // Ensure all company anchors exist, then add notes
    for (const domain of domains) {
      // Ensure anchor
      await sb
        .from("companies")
        .upsert(
          { domain, name: domain, first_viewed_by: userName, last_viewed_by: userName, source: "manual" },
          { onConflict: "domain", ignoreDuplicates: true }
        );

      // Add note
      await sb
        .from("company_notes")
        .insert({
          company_domain: domain,
          content: text,
          author_name: userName,
          mentions: "[]",
        });
    }

    return NextResponse.json({ ok: true, count: domains.length });
  } catch (err) {
    console.error("POST /api/bulk/note error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
