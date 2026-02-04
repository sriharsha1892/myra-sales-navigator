import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  const user = request.nextUrl.searchParams.get("user");
  const since = request.nextUrl.searchParams.get("since");
  const until = request.nextUrl.searchParams.get("until");

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ exports: [] });
  }

  let query = sb
    .from("exported_contacts")
    .select("*")
    .order("exported_at", { ascending: false })
    .limit(200);

  if (domain) {
    query = query.eq("company_domain", domain);
  }
  if (user) {
    query = query.eq("exported_by", user);
  }
  if (since) {
    query = query.gte("exported_at", since);
  }
  if (until) {
    query = query.lte("exported_at", until);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ExportHistory] GET error:", error);
    return NextResponse.json({ exports: [] });
  }

  return NextResponse.json({ exports: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { contacts, exportedBy, exportFormat, companyDomain } = body;

  if (!Array.isArray(contacts) || !exportedBy || !companyDomain) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ logged: 0 });
  }

  const rows = contacts.map((c: { email?: string; name?: string }) => ({
    contact_email: c.email ?? "",
    contact_name: c.name ?? "",
    company_domain: companyDomain,
    exported_by: exportedBy,
    export_format: exportFormat ?? "clipboard",
  }));

  const { error } = await sb.from("exported_contacts").insert(rows);

  if (error) {
    console.error("[ExportHistory] POST error:", error);
    return NextResponse.json({ logged: 0, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logged: rows.length });
}
