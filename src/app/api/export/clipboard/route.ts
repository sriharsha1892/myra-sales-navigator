import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface ContactPayload {
  firstName: string;
  lastName: string;
  email: string | null;
  title: string;
  companyName: string;
  phone?: string | null;
}

function applyTemplate(template: string, c: ContactPayload): string {
  return template
    .replace(/\{\{first_name\}\}/g, c.firstName)
    .replace(/\{\{last_name\}\}/g, c.lastName)
    .replace(/\{\{email\}\}/g, c.email ?? "")
    .replace(/\{\{title\}\}/g, c.title)
    .replace(/\{\{company\}\}/g, c.companyName)
    .replace(/\{\{phone\}\}/g, c.phone ?? "");
}

export async function POST(request: NextRequest) {
  try {
    const { contacts, format, companyDomain, userName } = (await request.json()) as {
      contacts: ContactPayload[];
      format?: string;
      companyDomain?: string;
      userName?: string;
    };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "contacts array is required" }, { status: 400 });
    }

    const template = format || "{{first_name}} {{last_name}} <{{email}}>";
    const lines = contacts.map((c) => applyTemplate(template, c));
    const text = lines.join("\n");

    // Log extraction to Supabase if we have context
    if (companyDomain && userName) {
      try {
        const supabase = createServerClient();

        // Ensure company anchor exists before logging extraction (FK constraint)
        await supabase.from("companies").upsert(
          {
            domain: companyDomain,
            name: companyDomain,
            first_viewed_by: userName,
            last_viewed_by: userName,
            source: "export",
          },
          { onConflict: "domain", ignoreDuplicates: true }
        );

        await supabase.from("contact_extractions").insert({
          company_domain: companyDomain,
          extracted_by: userName,
          destination: "clipboard",
          contacts: JSON.stringify(
            contacts.map((c) => ({
              name: `${c.firstName} ${c.lastName}`.trim(),
              title: c.title,
              email: c.email,
              company: c.companyName,
            }))
          ),
        });
      } catch (logErr) {
        // Don't fail the export if logging fails
        console.warn("[Export/Clipboard] Failed to log extraction:", logErr);
      }
    }

    return NextResponse.json({ text, count: contacts.length });
  } catch (err) {
    console.error("[Export/Clipboard] error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
