import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { domains, status, userName } = await request.json();
    if (!Array.isArray(domains) || !status || !userName) {
      return NextResponse.json({ error: "domains[], status, userName required" }, { status: 400 });
    }

    const sb = createServerClient();
    const now = new Date().toISOString();

    const { error } = await sb
      .from("companies")
      .update({ status, status_changed_by: userName, status_changed_at: now })
      .in("domain", domains);

    if (error) {
      console.error("Bulk status update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: domains.length });
  } catch (err) {
    console.error("POST /api/bulk/status error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
