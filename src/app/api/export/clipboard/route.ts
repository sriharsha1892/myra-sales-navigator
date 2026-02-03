import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface ContactPayload {
  firstName: string;
  lastName: string;
  email: string | null;
  title: string;
  companyName: string;
  companyDomain?: string;
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
    const { contacts: rawContacts, format, companyDomain, companyDomains, userName } = (await request.json()) as {
      contacts: ContactPayload[];
      format?: string;
      companyDomain?: string;
      companyDomains?: string[];
      userName?: string;
    };

    // Filter out contacts without email
    const contacts = rawContacts.filter((c) => c.email);

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "contacts array is required" }, { status: 400 });
    }

    const template = format || "{{first_name}} {{last_name}} <{{email}}>";
    const lines = contacts.map((c) => applyTemplate(template, c));
    const text = lines.join("\n");

    // Log extraction to Supabase — per-domain
    const domains = companyDomains ?? (companyDomain ? [companyDomain] : []);
    if (domains.length > 0 && userName) {
      try {
        const supabase = createServerClient();

        // Group contacts by domain
        const byDomain = new Map<string, ContactPayload[]>();
        for (const c of contacts) {
          const d = c.companyDomain ?? companyDomain ?? "";
          if (!d) continue;
          const arr = byDomain.get(d) ?? [];
          arr.push(c);
          byDomain.set(d, arr);
        }

        for (const [domain, domainContacts] of byDomain) {
          await supabase.from("companies").upsert(
            {
              domain,
              name: domain,
              first_viewed_by: userName,
              last_viewed_by: userName,
              source: "export",
            },
            { onConflict: "domain", ignoreDuplicates: true }
          );

          await supabase.from("contact_extractions").insert({
            company_domain: domain,
            extracted_by: userName,
            destination: "clipboard",
            contacts: JSON.stringify(
              domainContacts.map((c) => ({
                name: `${c.firstName} ${c.lastName}`.trim(),
                title: c.title,
                email: c.email,
                company: c.companyName,
              }))
            ),
          });
        }
      } catch (logErr) {
        console.warn("[Export/Clipboard] Failed to log extraction:", logErr);
      }
    }

    return NextResponse.json({ text, count: contacts.length, skipped: rawContacts.length - contacts.length });
  } catch (err) {
    console.error("[Export/Clipboard] error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
