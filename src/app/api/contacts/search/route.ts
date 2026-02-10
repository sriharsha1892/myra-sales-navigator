import { NextRequest, NextResponse } from "next/server";
import { scanCacheByPrefix } from "@/lib/cache";
import type { Contact } from "@/lib/navigator/types";

interface CachedContactsEntry {
  contacts: Contact[];
  sources: Record<string, boolean>;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.toLowerCase().trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ contacts: [] });
  }

  // Scan all enriched contacts cache entries
  const entries = scanCacheByPrefix<CachedContactsEntry>("enriched:contacts:");

  const matches: Contact[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!entry.contacts) continue;
    for (const c of entry.contacts) {
      if (seen.has(c.id)) continue;

      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const emailLower = c.email?.toLowerCase() ?? "";
      const companyLower = c.companyName?.toLowerCase() ?? "";

      if (
        fullName.includes(q) ||
        emailLower.includes(q) ||
        companyLower.includes(q)
      ) {
        seen.add(c.id);
        matches.push(c);
        if (matches.length >= 10) break;
      }
    }
    if (matches.length >= 10) break;
  }

  return NextResponse.json({ contacts: matches });
}
