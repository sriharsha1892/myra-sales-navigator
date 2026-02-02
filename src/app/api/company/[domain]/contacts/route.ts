import { NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/cache";
import { findContacts, isApolloAvailable } from "@/lib/providers/apollo";
import { getHubSpotContacts, isHubSpotAvailable } from "@/lib/providers/hubspot";
import type { Contact } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const normalized = normalizeDomain(decodeURIComponent(domain));

  const apolloAvailable = isApolloAvailable();
  const hubspotAvailable = isHubSpotAvailable();

  if (!apolloAvailable && !hubspotAvailable) {
    return NextResponse.json({
      contacts: [],
      sources: { apollo: false, hubspot: false },
      message: "No contact data sources configured.",
    }, { status: 503 });
  }

  try {
    // Fetch contacts from both sources in parallel
    const [apolloContacts, hubspotContacts] = await Promise.all([
      apolloAvailable ? findContacts(normalized) : Promise.resolve([]),
      hubspotAvailable ? getHubSpotContacts(normalized) : Promise.resolve([]),
    ]);

    // Merge and deduplicate
    const merged = mergeContacts(apolloContacts, hubspotContacts);

    return NextResponse.json({
      contacts: merged,
      sources: {
        apollo: apolloAvailable && apolloContacts.length > 0,
        hubspot: hubspotAvailable && hubspotContacts.length > 0,
      },
    });
  } catch (err) {
    console.error("[Contacts] Failed to fetch contacts:", err);
    return NextResponse.json({
      contacts: [],
      sources: { apollo: false, hubspot: false },
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
  hubspotContacts: Contact[]
): Contact[] {
  if (hubspotContacts.length === 0) return apolloContacts;
  if (apolloContacts.length === 0) return hubspotContacts;

  const merged: Contact[] = [...apolloContacts];
  const emailIndex = new Map<string, number>();
  const nameIndex = new Map<string, number>();

  // Index Apollo contacts by email and name
  for (let i = 0; i < apolloContacts.length; i++) {
    const c = apolloContacts[i];
    if (c.email) {
      emailIndex.set(c.email.toLowerCase(), i);
    }
    const nameKey = `${c.firstName.toLowerCase()}|${c.lastName.toLowerCase()}`;
    if (c.firstName && c.lastName) {
      nameIndex.set(nameKey, i);
    }
  }

  // Merge HubSpot contacts — dedupe by email or name
  for (const hc of hubspotContacts) {
    let matchIdx: number | undefined;

    if (hc.email) {
      matchIdx = emailIndex.get(hc.email.toLowerCase());
    }
    if (matchIdx === undefined && hc.firstName && hc.lastName) {
      const nameKey = `${hc.firstName.toLowerCase()}|${hc.lastName.toLowerCase()}`;
      matchIdx = nameIndex.get(nameKey);
    }

    if (matchIdx !== undefined) {
      // Duplicate — merge sources, fill gaps from HubSpot
      const existing = merged[matchIdx];
      if (!existing.sources.includes("hubspot")) {
        existing.sources = [...existing.sources, "hubspot"];
      }
      // HubSpot fills gaps (Apollo has priority per spec)
      if (!existing.phone && hc.phone) existing.phone = hc.phone;
      if (!existing.linkedinUrl && hc.linkedinUrl) existing.linkedinUrl = hc.linkedinUrl;
      if (!existing.lastVerified && hc.lastVerified) existing.lastVerified = hc.lastVerified;
    } else {
      // New contact from HubSpot only
      merged.push(hc);
    }
  }

  return merged;
}
