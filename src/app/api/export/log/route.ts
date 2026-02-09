import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { contacts, companyDomain, userName, destination } = await request.json();

    if (!companyDomain || !destination) {
      return NextResponse.json({ error: "companyDomain and destination required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("contact_extractions").insert({
      company_domain: companyDomain,
      extracted_by: userName ?? "Unknown",
      destination,
      contacts: Array.isArray(contacts) ? contacts : [],
    });

    if (error) {
      console.error("[ExportLog] insert error:", error);
      return NextResponse.json({ logged: 0 }, { status: 500 });
    }

    return NextResponse.json({ logged: 1 });
  } catch {
    return NextResponse.json({ logged: 0 }, { status: 500 });
  }
}
