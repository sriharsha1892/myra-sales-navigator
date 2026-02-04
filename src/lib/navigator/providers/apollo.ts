import type { CompanyEnriched, Contact } from "../types";
import { getCached, setCached, CacheKeys, normalizeDomain } from "../../cache";

// Cache TTL: 24 hours in minutes (for person enrichment — credit-bearing)
const APOLLO_CACHE_TTL = 1440;
// Cache TTL: 2 hours for contacts list (free endpoint, refresh more often)
const APOLLO_CONTACTS_CACHE_TTL = 120;

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

export interface ApolloSearchParams {
  domain?: string;
  industry?: string;
  employeeRange?: { min: number; max: number };
}

export interface ApolloSearchResult {
  companies: CompanyEnriched[];
  contacts: Contact[];
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isApolloAvailable(): boolean {
  return !!process.env.APOLLO_API_KEY;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apolloHeaders(): Record<string, string> {
  return {
    "x-api-key": process.env.APOLLO_API_KEY!,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function mapSeniority(
  seniority: string | null | undefined
): Contact["seniority"] {
  if (!seniority) return "staff";
  const s = seniority.toLowerCase();
  if (s.includes("c_suite") || s.includes("founder") || s.includes("owner"))
    return "c_level";
  if (s.includes("vp") || s.includes("vice")) return "vp";
  if (s.includes("director")) return "director";
  if (s.includes("manager") || s.includes("head")) return "manager";
  return "staff";
}

// ---------------------------------------------------------------------------
// enrichCompany — GET /organizations/enrich?domain=X
// ---------------------------------------------------------------------------

export async function enrichCompany(
  domain: string
): Promise<Partial<CompanyEnriched> | null> {
  if (!isApolloAvailable()) return null;

  const normalized = normalizeDomain(domain);
  const cacheKey = `apollo:company:${normalized}`;

  // Check cache first
  const cached = await getCached<Partial<CompanyEnriched>>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${APOLLO_BASE_URL}/organizations/enrich?domain=${encodeURIComponent(normalized)}`,
      { method: "GET", headers: apolloHeaders() }
    );

    if (!res.ok) {
      console.warn(
        `[Apollo] enrichCompany failed for ${normalized}: ${res.status} ${res.statusText}`
      );
      return null;
    }

    const data = await res.json();
    const org = data.organization;
    if (!org) return null;

    const enriched: Partial<CompanyEnriched> = {
      name: org.name || undefined,
      domain: normalized,
      industry: org.industry || "",
      employeeCount: org.estimated_num_employees || 0,
      location: [org.city, org.state, org.country]
        .filter(Boolean)
        .join(", "),
      region: org.country || "",
      description: org.short_description || org.seo_description || "",
      website: org.website_url || org.primary_domain || undefined,
      phone: org.phone || undefined,
      logoUrl: org.logo_url || undefined,
      revenue:
        org.estimated_annual_revenue
          ? `$${org.estimated_annual_revenue}`
          : org.annual_revenue_printed || undefined,
      founded: org.founded_year ? String(org.founded_year) : undefined,
      sources: ["apollo"],
      lastRefreshed: new Date().toISOString(),
    };

    await setCached(cacheKey, enriched, APOLLO_CACHE_TTL);
    return enriched;
  } catch (err) {
    console.error("[Apollo] enrichCompany error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// findContacts — POST /mixed_people/search (free, no credits)
// ---------------------------------------------------------------------------

export async function findContacts(domain: string): Promise<Contact[]> {
  if (!isApolloAvailable()) return [];

  const normalized = normalizeDomain(domain);
  const cacheKey = `apollo:contacts:${normalized}`;

  const cached = await getCached<Contact[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${APOLLO_BASE_URL}/mixed_people/api_search`, {
      method: "POST",
      headers: apolloHeaders(),
      body: JSON.stringify({
        q_organization_domains: normalized,
        per_page: 25,
        page: 1,
        person_seniorities: ["c_suite", "vp", "director", "manager"],
      }),
    });

    if (!res.ok) {
      console.warn(
        `[Apollo] findContacts failed for ${normalized}: ${res.status} ${res.statusText}`
      );
      return [];
    }

    const data = await res.json();
    const people: unknown[] = data.people || [];

    const contacts: Contact[] = people.map(
      (raw: unknown, i: number) => {
        const p = raw as Record<string, unknown>;
        const org = (p.organization as Record<string, unknown>) || {};
        return {
          id: (p.id as string) || `apollo-${normalized}-${i}`,
          companyDomain: normalized,
          companyName:
            (org.name as string) || normalized,
          firstName: (p.first_name as string) || "",
          lastName: (p.last_name as string) || (p.last_name_obfuscated as string) || "",
          title: (p.title as string) || "",
          email: (p.email as string) || null,
          phone: null, // not returned in api_search
          linkedinUrl: (p.linkedin_url as string) || null,
          headline: (p.headline as string) || null,
          emailConfidence: p.email ? 70 : 0,
          confidenceLevel: p.email ? "medium" : "none",
          sources: ["apollo"],
          seniority: mapSeniority((p.seniority as string) || (p.title as string)),
          lastVerified: null,
        };
      }
    );

    await setCached(cacheKey, contacts, APOLLO_CONTACTS_CACHE_TTL);
    return contacts;
  } catch (err) {
    console.error("[Apollo] findContacts error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// enrichContact — POST /people/match (costs 1 credit per call)
// On-demand: call when user clicks "Reveal" on a contact
// ---------------------------------------------------------------------------

export async function enrichContact(
  apolloId: string,
  hint?: { firstName?: string; lastName?: string; domain?: string }
): Promise<Contact | null> {
  if (!isApolloAvailable()) return null;

  const cacheKey = `apollo:person:${apolloId}`;
  const cached = await getCached<Contact>(cacheKey);
  if (cached) return cached;

  try {
    // Try ID-based match first
    const res = await fetch(`${APOLLO_BASE_URL}/people/match`, {
      method: "POST",
      headers: apolloHeaders(),
      body: JSON.stringify({
        id: apolloId,
        reveal_personal_emails: true,
      }),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p: any = null;

    if (res.ok) {
      const data = await res.json();
      p = data.person ?? null;
    } else {
      console.warn(
        `[Apollo] enrichContact ID match failed for ${apolloId}: ${res.status} ${res.statusText}`
      );
    }

    // Fallback: name + domain match if ID didn't resolve or returned no email
    if ((!p || !p.email) && hint?.firstName && hint?.domain) {
      try {
        const fallbackBody: Record<string, unknown> = {
          first_name: hint.firstName,
          domain: hint.domain,
          reveal_personal_emails: true,
        };
        // Only include last_name if it's not obfuscated (contains ***)
        if (hint.lastName && !hint.lastName.includes("*")) {
          fallbackBody.last_name = hint.lastName;
        }

        const fallbackRes = await fetch(`${APOLLO_BASE_URL}/people/match`, {
          method: "POST",
          headers: apolloHeaders(),
          body: JSON.stringify(fallbackBody),
        });

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.person?.email) {
            p = fallbackData.person;
          }
        }
      } catch (fallbackErr) {
        console.warn("[Apollo] enrichContact name fallback failed:", fallbackErr);
      }
    }

    if (!p) return null;

    const org = p.organization || {};
    const domain = normalizeDomain(org.primary_domain || org.website_url || "");

    const contact: Contact = {
      id: p.id || apolloId,
      companyDomain: domain,
      companyName: org.name || domain,
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      title: p.title || "",
      email: p.email || null,
      phone: p.phone_numbers?.[0]?.sanitized_number || null,
      linkedinUrl: p.linkedin_url || null,
      headline: p.headline || null,
      emailConfidence: p.email
        ? Math.round(p.email_confidence ?? 70)
        : 0,
      confidenceLevel: p.email
        ? (p.email_confidence ?? 70) >= 90
          ? "high"
          : (p.email_confidence ?? 70) >= 70
            ? "medium"
            : "low"
        : "none",
      sources: ["apollo"],
      seniority: mapSeniority(p.seniority || p.title),
      lastVerified: null,
    };

    await setCached(cacheKey, contact, APOLLO_CACHE_TTL);
    return contact;
  } catch (err) {
    console.error("[Apollo] enrichContact error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// getApolloCredits — GET /auth/health for plan/credit info
// ---------------------------------------------------------------------------

export async function getApolloCredits(): Promise<{ available: number; total: number } | null> {
  if (!isApolloAvailable()) return null;

  try {
    const res = await fetch(`${APOLLO_BASE_URL}/auth/health`, {
      method: "GET",
      headers: apolloHeaders(),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const plan = data.plan ?? data;
    const available = plan.credits_remaining ?? plan.credits_available ?? null;
    const total = plan.credits_limit ?? plan.credits_total ?? null;
    if (available === null) return null;
    return { available, total: total ?? available };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// searchApollo — company search (placeholder for now)
// Apollo's search is people-focused; company discovery stays with Exa.
// ---------------------------------------------------------------------------

export async function searchApollo(
  _params: ApolloSearchParams
): Promise<ApolloSearchResult> {
  return { companies: [], contacts: [] };
}
