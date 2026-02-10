import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { domain, decision, decidedBy } = await request.json();
    if (!domain || !decision || !decidedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("company_decisions")
      .upsert(
        { domain, decision, decided_by: decidedBy, decided_at: new Date().toISOString() },
        { onConflict: "domain,decided_by" }
      );

    if (error) {
      console.error("[company-decisions] upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget activity log
    Promise.resolve(
      supabase.from("company_activity_log").insert({
        company_domain: domain,
        user_name: decidedBy,
        activity_type: "triage",
        metadata: { decision },
      })
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[company-decisions] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { domain } = await request.json();
    if (!domain) {
      return NextResponse.json({ error: "Missing domain" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("company_decisions")
      .delete()
      .eq("domain", domain);

    if (error) {
      console.error("[company-decisions] delete error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[company-decisions] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get("user");

    const supabase = createServerClient();
    let query = supabase.from("company_decisions").select("domain, decision, decided_by, decided_at");
    if (userName) {
      query = query.eq("decided_by", userName);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[company-decisions] query error:", error.message);
      return NextResponse.json({ decisions: [] });
    }

    return NextResponse.json({ decisions: data ?? [] });
  } catch (err) {
    console.error("[company-decisions] error:", err);
    return NextResponse.json({ decisions: [] });
  }
}
