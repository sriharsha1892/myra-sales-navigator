import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, contactName, companyDomain, userName } = await request.json();

    if (!email || !companyDomain) {
      return NextResponse.json({ error: "email and companyDomain required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("contact_extractions").insert({
      company_domain: companyDomain,
      extracted_by: userName ?? "Unknown",
      destination: "email_copy",
      contacts: [{ email, name: contactName ?? "" }],
    });

    if (error) {
      console.error("[LogCopy] insert error:", error);
      return NextResponse.json({ logged: 0 }, { status: 500 });
    }

    return NextResponse.json({ logged: 1 });
  } catch {
    return NextResponse.json({ logged: 0 }, { status: 500 });
  }
}
