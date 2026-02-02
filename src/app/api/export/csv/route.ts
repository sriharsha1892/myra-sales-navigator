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
}

function escapeCsv(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

const CSV_HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Title",
  "Company",
  "Domain",
  "Phone",
  "LinkedIn",
  "Seniority",
  "Email Confidence",
];

export async function POST(request: NextRequest) {
  try {
    const { contacts, companyDomain, userName } = (await request.json()) as {
      contacts: ContactPayload[];
      companyDomain?: string;
      userName?: string;
    };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "contacts array is required" }, { status: 400 });
    }

    const rows = contacts.map((c) =>
      [
        escapeCsv(c.firstName),
        escapeCsv(c.lastName),
        escapeCsv(c.email ?? ""),
        escapeCsv(c.title),
        escapeCsv(c.companyName),
        escapeCsv(c.companyDomain ?? ""),
        escapeCsv(c.phone ?? ""),
        escapeCsv(c.linkedinUrl ?? ""),
        escapeCsv(c.seniority ?? ""),
        String(c.emailConfidence ?? ""),
      ].join(",")
    );

    const csv = [CSV_HEADERS.join(","), ...rows].join("\n");

    // Log extraction to Supabase
    if (companyDomain && userName) {
      try {
        const supabase = createServerClient();

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
          destination: "csv",
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
        console.warn("[Export/CSV] Failed to log extraction:", logErr);
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
