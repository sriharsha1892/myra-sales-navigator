import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const { status, userName } = await request.json();

    if (!status || !userName) {
      return NextResponse.json(
        { error: "status and userName are required" },
        { status: 400 }
      );
    }

    const sb = createServerClient();
    const { error } = await sb
      .from("companies")
      .update({
        status,
        status_changed_by: userName,
        status_changed_at: new Date().toISOString(),
      })
      .eq("domain", domain);

    if (error) {
      console.error("Update company status error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/company/[domain]/status error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
