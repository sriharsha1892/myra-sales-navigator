import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  const contactId = request.nextUrl.searchParams.get("contactId");
  if (!contactId) {
    return NextResponse.json({ drafts: [] });
  }

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ drafts: [] });
  }

  try {
    const { data, error } = await sb
      .from("outreach_drafts")
      .select("channel, generated_at")
      .eq("contact_id", contactId)
      .order("generated_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ drafts: [] });
    }

    return NextResponse.json({ drafts: data ?? [] });
  } catch {
    return NextResponse.json({ drafts: [] });
  }
}
