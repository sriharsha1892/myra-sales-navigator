import { NextResponse } from "next/server";
import { normalizeDomain, getRootDomain, getCached, setCached, deleteCached, CacheKeys, CacheTTL } from "@/lib/cache";
import { findContacts, enrichContact, isApolloAvailable } from "@/lib/navigator/providers/apollo";
import { getHubSpotContacts, isHubSpotAvailable } from "@/lib/navigator/providers/hubspot";
import { getFreshsalesContacts, isFreshsalesAvailable } from "@/lib/navigator/providers/freshsales";
import { findEmailsBatch, isClearoutAvailable } from "@/lib/navigator/providers/clearout";
import { pLimit } from "@/lib/utils";
import { createServerClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/navigator/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const normalized = normalizeDomain(decodeURIComponent(domain));
  const url = new URL(request.url);
  const companyName = url.searchParams.get("name") || undefined;
  const refreshRequested = url.searchParams.get("refresh") === "true";

  // Check enriched contacts cache (skip if refresh requested)
  const enrichedCacheKey = CacheKeys.enrichedContacts(normalized);
  if (!refreshRequested) {
    const cached = await getCached<{ contacts: Contact[]; sources: Record<string, boolean> }>(enrichedCacheKey);
    if (cached) {
      console.log(`[Contacts] ${normalized}: returning cached enriched contacts (${cached.contacts.length})`);
      return NextResponse.json(cached);
    }
  } else {
    await deleteCached(enrichedCacheKey);
    // Also clear Apollo contacts list cache so we get fresh data
    await deleteCached(`apollo:contacts:${normalized}`);
  }

  const apolloAvailable = isApolloAvailable();
  const hubspotAvailable = isHubSpotAvailable();
  const freshsalesAvailable = isFreshsalesAvailable();

  if (!apolloAvailable && !hubspotAvailable && !freshsalesAvailable) {
    return NextResponse.json({
      contacts: [],
      sources: { apollo: false, hubspot: false, freshsales: false },
      message: "No contact data sources configured.",
    }, { status: 503 });
  }

  try {
    // Fetch contacts from all sources in parallel
    const [apolloContacts, hubspotContacts, freshsalesContacts] = await Promise.all([
      apolloAvailable ? findContacts(normalized) : Promise.resolve([]),
      hubspotAvailable ? getHubSpotContacts(normalized) : Promise.resolve([]),
      freshsalesAvailable ? getFreshsalesContacts(getRootDomain(normalized), companyName) : Promise.resolve([]),
    ]);

    console.log(`[Contacts] ${normalized}: apollo=${apolloContacts.length} hubspot=${hubspotContacts.length} freshsales=${freshsalesContacts.length}`);

    // Merge and deduplicate
    const merged = mergeContacts(apolloContacts, hubspotContacts, freshsalesContacts);

    // Auto-enrich all contacts by seniority that have no email (Apollo contacts only)
    // Cap at 5 concurrent. Apollo is 100 req/min shared. Don't be a hero.
    const limit = pLimit(5);
    const seniorityOrder: Record<string, number> = { c_level: 0, vp: 1, director: 2, manager: 3, staff: 4 };
    const needsEnrich = merged
      .filter((c) => !c.email && c.id && !c.id.startsWith("hubspot-") && !c.id.startsWith("freshsales-"))
      .sort((a, b) => (seniorityOrder[a.seniority] ?? 5) - (seniorityOrder[b.seniority] ?? 5));

    if (needsEnrich.length > 0 && apolloAvailable) {
      const enrichResults = await Promise.allSettled(
        needsEnrich.map((c) =>
          limit(() => enrichContact(c.id, {
            firstName: c.firstName,
            lastName: c.lastName,
            domain: normalized,
          }))
        )
      );
      for (let i = 0; i < needsEnrich.length; i++) {
        const result = enrichResults[i];
        if (result.status === "fulfilled" && result.value) {
          const enriched = result.value;
          const idx = merged.findIndex((c) => c.id === needsEnrich[i].id);
          if (idx !== -1) {
            merged[idx] = {
              ...merged[idx],
              firstName: (enriched.firstName && !enriched.firstName.includes("*"))
                ? enriched.firstName : merged[idx].firstName,
              lastName: (enriched.lastName && !enriched.lastName.includes("*"))
                ? enriched.lastName : merged[idx].lastName,
              email: enriched.email || merged[idx].email,
              emailConfidence: enriched.email ? enriched.emailConfidence : merged[idx].emailConfidence,
              confidenceLevel: enriched.email ? enriched.confidenceLevel : merged[idx].confidenceLevel,
              phone: enriched.phone || merged[idx].phone,
              title: enriched.title || merged[idx].title,
              linkedinUrl: enriched.linkedinUrl || merged[idx].linkedinUrl,
            };
          }
        }
      }
    }

    // Clearout-first fallback: find emails for contacts still missing after Apollo enrichment
    const stillMissing = merged.filter((c) => !c.email && c.firstName);
    if (stillMissing.length > 0 && isClearoutAvailable()) {
      try {
        const batch = stillMissing.slice(0, 10).map((c) => ({
          contactId: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
        }));
        const clearoutResults = await findEmailsBatch(batch, normalized, 10);
        for (const cr of clearoutResults) {
          if (!cr.email) continue;
          const idx = merged.findIndex((c) => c.id === cr.contactId);
          if (idx !== -1) {
            merged[idx] = {
              ...merged[idx],
              email: cr.email,
              emailConfidence: cr.confidence ?? 70,
              confidenceLevel: (cr.confidence ?? 70) >= 90 ? "high" : (cr.confidence ?? 70) >= 70 ? "medium" : "low",
              sources: [...new Set([...merged[idx].sources, "clearout" as const])],
            };
          }
        }
        console.log(`[Contacts] ${normalized}: Clearout found ${clearoutResults.filter((r) => r.email).length}/${batch.length} emails`);
      } catch (err) {
        console.warn("[Contacts] Clearout fallback failed:", err);
      }
    }

    // Filter out contact_id exclusions
    try {
      const supabase = createServerClient();
      const { data: contactIdExclusions } = await supabase
        .from("exclusions")
        .select("value")
        .eq("type", "contact_id");
      if (contactIdExclusions && contactIdExclusions.length > 0) {
        const excludedIds = new Set(contactIdExclusions.map((e) => e.value));
        const beforeCount = merged.length;
        const filtered = merged.filter((c) => !excludedIds.has(c.id));
        if (filtered.length < beforeCount) {
          console.log(`[Contacts] ${normalized}: filtered ${beforeCount - filtered.length} contact_id exclusions`);
        }
        merged.splice(0, merged.length, ...filtered);
      }
    } catch { /* non-fatal */ }

    // Sort: Freshsales contacts first, then by seniority
    const seniorityRank: Record<string, number> = {
      c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
    };
    merged.sort((a, b) => {
      const aFS = a.sources.includes("freshsales") ? 0 : 1;
      const bFS = b.sources.includes("freshsales") ? 0 : 1;
      if (aFS !== bFS) return aFS - bFS;
      return (seniorityRank[a.seniority] ?? 5) - (seniorityRank[b.seniority] ?? 5);
    });

    const responseData = {
      contacts: merged,
      sources: {
        apollo: apolloAvailable && apolloContacts.length > 0,
        hubspot: hubspotAvailable && hubspotContacts.length > 0,
        freshsales: freshsalesAvailable && freshsalesContacts.length > 0,
      },
    };

    // Cache enriched contacts for 2 hours
    await setCached(enrichedCacheKey, responseData, CacheTTL.enrichedContacts);

    return NextResponse.json(responseData);
  } catch (err) {
    console.error("[Contacts] Failed to fetch contacts:", err);
    return NextResponse.json({
      contacts: [],
      sources: { apollo: false, hubspot: false, freshsales: false },
      error: "Failed to fetch contacts.",
    }, { status: 500 });
  }
}

/**
 * Merge Apollo and HubSpot contacts, deduplicating by email or name match.
 * Apollo takes priority for email/title per conflict resolution spec.
 */
function mergeContacts(
  apolloContacts: Contact[],
  hubspotContacts: Contact[],
  freshsalesContacts: Contact[] = []
): Contact[] {
  // Initialize fieldSources for Apollo contacts
  const merged: Contact[] = apolloContacts.map((c) => ({
    ...c,
    fieldSources: {
      ...(c.email ? { email: "apollo" as const } : {}),
      ...(c.phone ? { phone: "apollo" as const } : {}),
      ...(c.title ? { title: "apollo" as const } : {}),
      ...(c.linkedinUrl ? { linkedinUrl: "apollo" as const } : {}),
    },
  }));
  const emailIndex = new Map<string, number>();
  const nameIndex = new Map<string, number>();

  // Index existing contacts by email and name
  function reindex() {
    emailIndex.clear();
    nameIndex.clear();
    for (let i = 0; i < merged.length; i++) {
      const c = merged[i];
      if (c.email) {
        emailIndex.set(c.email.toLowerCase(), i);
      }
      if (c.firstName && c.lastName) {
        const nameKey = `${c.firstName.toLowerCase()}|${c.lastName.toLowerCase()}`;
        nameIndex.set(nameKey, i);
      }
    }
  }

  function mergeSource(contacts: Contact[], sourceLabel: string) {
    reindex();
    const src = sourceLabel as Contact["sources"][number];
    for (const sc of contacts) {
      let matchIdx: number | undefined;

      if (sc.email) {
        matchIdx = emailIndex.get(sc.email.toLowerCase());
      }
      if (matchIdx === undefined && sc.firstName && sc.lastName) {
        const nameKey = `${sc.firstName.toLowerCase()}|${sc.lastName.toLowerCase()}`;
        matchIdx = nameIndex.get(nameKey);
      }

      if (matchIdx !== undefined) {
        const existing = merged[matchIdx];
        if (!existing.sources.includes(src)) {
          existing.sources = [...existing.sources, src];
        }
        const fs = existing.fieldSources ?? {};
        if (!existing.phone && sc.phone) {
          existing.phone = sc.phone;
          fs.phone = src;
        }
        if (!existing.linkedinUrl && sc.linkedinUrl) {
          existing.linkedinUrl = sc.linkedinUrl;
          fs.linkedinUrl = src;
        }
        if (!existing.lastVerified && sc.lastVerified) existing.lastVerified = sc.lastVerified;
        existing.fieldSources = fs;
      } else {
        // New contact from this source — set fieldSources
        merged.push({
          ...sc,
          fieldSources: {
            ...(sc.email ? { email: src } : {}),
            ...(sc.phone ? { phone: src } : {}),
            ...(sc.title ? { title: src } : {}),
            ...(sc.linkedinUrl ? { linkedinUrl: src } : {}),
          },
        });
      }
    }
  }

  mergeSource(hubspotContacts, "hubspot");
  mergeSource(freshsalesContacts, "freshsales");

  // Carry over crmStatus from Freshsales contacts
  reindex();
  for (const fc of freshsalesContacts) {
    if (fc.crmStatus) {
      const matchIdx = fc.email
        ? emailIndex.get(fc.email.toLowerCase())
        : undefined;
      const nameKey = fc.firstName && fc.lastName
        ? `${fc.firstName.toLowerCase()}|${fc.lastName.toLowerCase()}`
        : null;
      const idx = matchIdx ?? (nameKey ? nameIndex.get(nameKey) : undefined);
      if (idx !== undefined && !merged[idx].crmStatus) {
        merged[idx].crmStatus = fc.crmStatus;
      }
    }
  }

  return merged;
}
