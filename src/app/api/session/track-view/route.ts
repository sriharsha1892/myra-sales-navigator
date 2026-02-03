import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { domain, name, userName } = await request.json();

    if (!domain || !userName) {
      return NextResponse.json({ error: "domain and userName required" }, { status: 400 });
    }

    const sb = createServerClient();
    const now = new Date().toISOString();

    // Upsert company anchor — create if missing, update view fields if exists
    const { error } = await sb
      .from("companies")
      .upsert(
        {
          domain,
          name: name || domain,
          first_viewed_by: userName,
          first_viewed_at: now,
          last_viewed_by: userName,
          last_viewed_at: now,
          viewed_by: userName,
          source: "exa",
        },
        { onConflict: "domain", ignoreDuplicates: false }
      );

    if (error) {
      // If upsert conflict, just update view fields
      await sb
        .from("companies")
        .update({
          last_viewed_by: userName,
          last_viewed_at: now,
          viewed_by: userName,
        })
        .eq("domain", domain);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/session/track-view error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
