import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { domain, addedBy } = await request.json();
    if (!domain || !addedBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("prospect_lists")
      .upsert(
        { domain, added_by: addedBy, added_at: new Date().toISOString() },
        { onConflict: "domain,added_by" }
      );

    if (error) {
      console.error("[prospect-list] upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[prospect-list] error:", err);
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
      .from("prospect_lists")
      .delete()
      .eq("domain", domain);

    if (error) {
      console.error("[prospect-list] delete error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[prospect-list] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get("user");

    const supabase = createServerClient();
    let query = supabase.from("prospect_lists").select("domain, added_by, added_at");
    if (userName) {
      query = query.eq("added_by", userName);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[prospect-list] query error:", error.message);
      return NextResponse.json({ prospects: [] });
    }

    return NextResponse.json({ prospects: data ?? [] });
  } catch (err) {
    console.error("[prospect-list] error:", err);
    return NextResponse.json({ prospects: [] });
  }
}
