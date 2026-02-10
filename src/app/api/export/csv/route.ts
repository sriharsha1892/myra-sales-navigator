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
  linkedinUrl?: string | null;
  seniority?: string;
  emailConfidence?: number;
  sources?: string[];
}

function escapeCsv(field: string | undefined | null): string {
  const value = field ?? "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

const ALL_COLUMNS: { key: string; header: string; extract: (c: ContactPayload) => string }[] = [
  { key: "name", header: "First Name", extract: (c) => c.firstName },
  { key: "name", header: "Last Name", extract: (c) => c.lastName },
  { key: "email", header: "Email", extract: (c) => c.email ?? "" },
  { key: "title", header: "Title", extract: (c) => c.title },
  { key: "company", header: "Company", extract: (c) => c.companyName },
  { key: "domain", header: "Domain", extract: (c) => c.companyDomain ?? "" },
  { key: "phone", header: "Phone", extract: (c) => c.phone ?? "" },
  { key: "linkedin", header: "LinkedIn", extract: (c) => c.linkedinUrl ?? "" },
  { key: "seniority", header: "Seniority", extract: (c) => c.seniority ?? "" },
  { key: "confidence", header: "Email Confidence", extract: (c) => String(c.emailConfidence ?? "") },
  { key: "freshsales", header: "In Freshsales", extract: (c) => (c.sources ?? []).includes("freshsales") ? "Yes" : "No" },
];

export async function POST(request: NextRequest) {
  try {
    const { contacts: rawContacts, companyDomain, companyDomains, userName, csvColumns } = (await request.json()) as {
      contacts: ContactPayload[];
      companyDomain?: string;
      companyDomains?: string[];
      userName?: string;
      csvColumns?: string[];
    };

    // Filter out contacts without email
    const contacts = rawContacts.filter((c) => c.email);

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "contacts array is required" }, { status: 400 });
    }

    // Filter columns if csvColumns specified, otherwise use all
    const columns = csvColumns?.length
      ? ALL_COLUMNS.filter((col) => csvColumns.includes(col.key))
      : ALL_COLUMNS;

    const rows = contacts.map((c) =>
      columns.map((col) => escapeCsv(col.extract(c))).join(",")
    );

    const csv = [columns.map((col) => col.header).join(","), ...rows].join("\n");

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
            destination: "csv",
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
        console.warn("[Export/CSV] Failed to log extraction:", logErr);
      }
    }

    // Fire-and-forget activity log — one entry per domain
    if (domains.length > 0 && userName) {
      const supabaseLog = createServerClient();
      for (const domain of domains) {
        const domainContacts = contacts.filter((c) => (c.companyDomain ?? companyDomain) === domain);
        Promise.resolve(
          supabaseLog.from("company_activity_log").insert({
            company_domain: domain,
            user_name: userName,
            activity_type: "export",
            metadata: { contactCount: domainContacts.length, destination: "csv" },
          })
        ).catch(() => {});
      }
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="contacts-${companyDomain || "export"}-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("[Export/CSV] error:", err);
    return NextResponse.json({ error: "CSV export failed" }, { status: 500 });
  }
}
