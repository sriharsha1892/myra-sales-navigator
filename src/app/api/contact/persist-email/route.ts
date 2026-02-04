import { NextResponse } from "next/server";
import { getCached, setCached, CacheKeys, CacheTTL, normalizeDomain } from "@/lib/cache";
import type { Contact } from "@/lib/navigator/types";

interface RequestBody {
  domain: string;
  contactId: string;
  email: string;
  emailConfidence?: number;
  confidenceLevel?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.domain || !body.contactId || !body.email) {
      return NextResponse.json(
        { error: "domain, contactId, and email are required" },
        { status: 400 }
      );
    }

    const normalized = normalizeDomain(body.domain);
    const cacheKey = CacheKeys.enrichedContacts(normalized);
    const cached = await getCached<{ contacts: Contact[]; sources: Record<string, boolean> }>(cacheKey);

    if (!cached) {
      console.warn(`[persist-email] Cache miss for domain "${normalized}" (key: ${cacheKey})`);
      return NextResponse.json({ success: true, persisted: false, reason: "cache_miss" });
    }

    const idx = cached.contacts.findIndex((c) => c.id === body.contactId);
    if (idx === -1) {
      console.warn(`[persist-email] Contact "${body.contactId}" not found in cache for domain "${normalized}"`);
      return NextResponse.json({ success: true, persisted: false, reason: "contact_not_found" });
    }

    cached.contacts[idx] = {
      ...cached.contacts[idx],
      email: body.email,
      emailConfidence: body.emailConfidence ?? 70,
      confidenceLevel: (body.confidenceLevel as Contact["confidenceLevel"]) ?? "medium",
    };
    await setCached(cacheKey, cached, CacheTTL.enrichedContacts);

    return NextResponse.json({ success: true, persisted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to persist email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
