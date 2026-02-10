import type { CompanyEnriched, Contact } from "../types";
import { getCached, setCached, CacheKeys, normalizeDomain, getRootDomain } from "../../cache";
import { apiCallBreadcrumb } from "@/lib/sentry";
import { logApiCall } from "../health";
import { withRetry, HttpError } from "../retry";
import { CACHE_TTLS } from "../cache-config";

// Cache TTL: 24 hours in minutes (for person enrichment — credit-bearing)
const APOLLO_CACHE_TTL = CACHE_TTLS.apolloPerson;
// Cache TTL: 2 hours for contacts list (free endpoint, refresh more often)
const APOLLO_CONTACTS_CACHE_TTL = CACHE_TTLS.apolloContacts;

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
    apiCallBreadcrumb("apollo", "enrichCompany", { domain: normalized });
    const _start = Date.now();
    const res = await withRetry(
      async () => {
        const r = await fetch(
          `${APOLLO_BASE_URL}/organizations/enrich?domain=${encodeURIComponent(normalized)}`,
          { method: "GET", headers: apolloHeaders() }
        );
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Apollo", maxRetries: 2 }
    );

    const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
    logApiCall({
      source: "apollo", endpoint: "organizations/enrich", status_code: res.status,
      success: res.ok, latency_ms: Date.now() - _start,
      rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : null,
      error_message: null,
      context: { domain: normalized }, user_name: null,
    });

    const data = await res.json();
    const org = data.organization;
    if (!org) return null;

    apiCallBreadcrumb("apollo", "enrichCompany complete", { domain: normalized, found: true });

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
    apiCallBreadcrumb("apollo", "findContacts", { domain: normalized });
    const _start = Date.now();
    const res = await withRetry(
      async () => {
        const r = await fetch(`${APOLLO_BASE_URL}/mixed_people/api_search`, {
          method: "POST",
          headers: apolloHeaders(),
          body: JSON.stringify({
            q_organization_domains: normalized,
            per_page: 25,
            page: 1,
            person_seniorities: ["c_suite", "vp", "director", "manager"],
          }),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Apollo", maxRetries: 2 }
    );

    const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
    logApiCall({
      source: "apollo", endpoint: "mixed_people/api_search", status_code: res.status,
      success: res.ok, latency_ms: Date.now() - _start,
      rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining, 10) : null,
      error_message: null,
      context: { domain: normalized }, user_name: null,
    });

    const data = await res.json();
    const people: unknown[] = data.people || [];
    apiCallBreadcrumb("apollo", "findContacts complete", { domain: normalized, count: people.length });

    const queriedRoot = getRootDomain(normalized);

    const allContacts: Contact[] = people.map(
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
          _orgDomain: (org.primary_domain as string) || (org.website_url as string) || null,
          _orgName: (org.name as string) || null,
        } as Contact & { _orgDomain: string | null; _orgName: string | null };
      }
    );

    // Filter out cross-domain contacts — Apollo sometimes returns loosely-related people
    const contacts: Contact[] = [];
    let filteredOut = 0;
    for (const c of allContacts) {
      const ext = c as Contact & { _orgDomain: string | null; _orgName: string | null };
      const orgDomain = ext._orgDomain;
      if (orgDomain) {
        const contactRoot = getRootDomain(normalizeDomain(orgDomain));
        if (contactRoot !== queriedRoot) {
          filteredOut++;
          continue;
        }
      } else {
        // orgDomain is null — fall back to org name check
        const orgName = ext._orgName?.toLowerCase() ?? "";
        const domainWord = queriedRoot.split(".")[0];
        if (orgName && !orgName.includes(domainWord) && !domainWord.includes(orgName.split(" ")[0])) {
          filteredOut++;
          continue;
        }
      }
      // Strip internal fields before caching
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (c as any)._orgDomain;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (c as any)._orgName;
      contacts.push(c);
    }

    if (filteredOut > 0) {
      console.warn(`[Apollo] filtered ${filteredOut} cross-domain contacts for ${normalized}`);
    }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let p: any = null;

    try {
      const res = await withRetry(
        async () => {
          const r = await fetch(`${APOLLO_BASE_URL}/people/match`, {
            method: "POST",
            headers: apolloHeaders(),
            body: JSON.stringify({
              id: apolloId,
              reveal_personal_emails: true,
            }),
          });
          if (!r.ok) throw new HttpError(r.status, r.statusText);
          return r;
        },
        { label: "Apollo", maxRetries: 2 }
      );
      const data = await res.json();
      p = data.person ?? null;
    } catch (err) {
      console.warn(
        `[Apollo] enrichContact ID match failed for ${apolloId}:`,
        err instanceof HttpError ? `${err.status} ${err.statusText}` : err
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

        const fallbackRes = await withRetry(
          async () => {
            const r = await fetch(`${APOLLO_BASE_URL}/people/match`, {
              method: "POST",
              headers: apolloHeaders(),
              body: JSON.stringify(fallbackBody),
            });
            if (!r.ok) throw new HttpError(r.status, r.statusText);
            return r;
          },
          { label: "Apollo", maxRetries: 2 }
        );

        const fallbackData = await fallbackRes.json();
        if (fallbackData.person?.email) {
          p = fallbackData.person;
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
    const res = await withRetry(
      async () => {
        const r = await fetch(`${APOLLO_BASE_URL}/auth/health`, {
          method: "GET",
          headers: apolloHeaders(),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Apollo", maxRetries: 2 }
    );

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
