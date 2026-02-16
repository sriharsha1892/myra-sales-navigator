import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

function getFollowUpStatus(exportedAt: string): "fresh" | "follow_up" | "stale" {
  const daysSince = (Date.now() - new Date(exportedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 3) return "fresh";
  if (daysSince <= 7) return "follow_up";
  return "stale";
}

export async function GET() {
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ exports: [] });
  }

  try {
    const supabase = createServerClient();
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("contact_extractions")
      .select("company_domain, contacts, extracted_by, extracted_at")
      .eq("extracted_by", userName)
      .gte("extracted_at", since)
      .order("extracted_at", { ascending: false });

    if (error) throw error;

    const domainMap = new Map<string, { contactCount: number; latestAt: string }>();
    for (const row of data ?? []) {
      const domain = row.company_domain;
      if (!domain) continue;
      const existing = domainMap.get(domain);
      const contacts = Array.isArray(row.contacts) ? row.contacts.length : 0;
      if (existing) {
        existing.contactCount += contacts;
        if (row.extracted_at > existing.latestAt) {
          existing.latestAt = row.extracted_at;
        }
      } else {
        domainMap.set(domain, {
          contactCount: contacts,
          latestAt: row.extracted_at,
        });
      }
    }

    const exports = [...domainMap.entries()]
      .map(([domain, info]) => ({
        domain,
        contactCount: info.contactCount,
        latestAt: info.latestAt,
        daysAgo: Math.floor((Date.now() - new Date(info.latestAt).getTime()) / (1000 * 60 * 60 * 24)),
        status: getFollowUpStatus(info.latestAt),
      }))
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
      .slice(0, 10);

    return NextResponse.json({ exports });
  } catch {
    return NextResponse.json({ exports: [] });
  }
}
