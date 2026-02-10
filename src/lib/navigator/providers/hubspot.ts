import type { Contact, HubSpotStatus } from "../types";
import { getCached, setCached, normalizeDomain } from "../../cache";
import { apiCallBreadcrumb } from "@/lib/sentry";
import { logApiCall } from "../health";
import { withRetry, HttpError } from "../retry";
import { CACHE_TTLS } from "../cache-config";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const HUBSPOT_CACHE_TTL = CACHE_TTLS.hubspot; // 1 hour in minutes

export interface HubSpotStatusResult {
  domain: string;
  status: HubSpotStatus;
  lastContact: string | null;
  dealStage: string | null;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isHubSpotAvailable(): boolean {
  return !!process.env.HUBSPOT_ACCESS_TOKEN;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hubspotHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Contact sanitization — clean bad names + filter out generic email providers
// ---------------------------------------------------------------------------

const SALUTATION_PATTERN = /^(sir|madam|sir\/madam|sir ?\/ ?madam|dear sir|dear madam|mr|mrs|ms|miss|dr)$/i;

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "live.com",
  "me.com",
  "msn.com",
  "rediffmail.com",
]);

export function sanitizeContacts(contacts: Contact[], domain: string): Contact[] {
  const normalizedDomain = domain.toLowerCase();
  return contacts
    .filter((c) => {
      // Keep contacts with no email — they may still have phone/name info
      if (!c.email) return true;
      const emailDomain = c.email.toLowerCase().split("@")[1];
      // Exclude contacts whose email matches the queried company domain (own-domain)
      if (emailDomain === normalizedDomain) {
        return false;
      }
      // Filter out contacts with generic/personal email providers
      if (emailDomain && GENERIC_EMAIL_DOMAINS.has(emailDomain)) {
        return false;
      }
      return true;
    })
    .map((c) => {
      let firstName = (c.firstName || "").trim();
      let lastName = (c.lastName || "").trim();

      // Strip salutation-only first names
      if (SALUTATION_PATTERN.test(firstName)) {
        firstName = "";
      }

      // If lastName looks like an email, clear it
      if (lastName.includes("@")) {
        lastName = "";
      }

      // If firstName === lastName, keep firstName only
      if (firstName && lastName && firstName.toLowerCase() === lastName.toLowerCase()) {
        lastName = "";
      }

      return { ...c, firstName, lastName };
    });
}

function mapSeniority(title: string | null | undefined): Contact["seniority"] {
  if (!title) return "staff";
  const t = title.toLowerCase();
  if (
    t.includes("ceo") ||
    t.includes("cto") ||
    t.includes("cfo") ||
    t.includes("coo") ||
    t.includes("chief") ||
    t.includes("founder") ||
    t.includes("owner")
  )
    return "c_level";
  if (t.includes("vp") || t.includes("vice president")) return "vp";
  if (t.includes("director")) return "director";
  if (t.includes("manager") || t.includes("head of")) return "manager";
  return "staff";
}

function deriveStatus(
  lifecycleStage: string | null,
  dealStages: string[]
): { status: HubSpotStatus; dealStage: string | null } {
  // Check deal stages first (most specific)
  for (const stage of dealStages) {
    const s = stage.toLowerCase();
    if (s === "closedwon") return { status: "closed_won", dealStage: stage };
    if (s === "closedlost") return { status: "closed_lost", dealStage: stage };
  }
  // Any active deal
  if (dealStages.length > 0) {
    return { status: "in_progress", dealStage: dealStages[0] };
  }
  // Fall back to lifecycle stage
  if (lifecycleStage) {
    const lc = lifecycleStage.toLowerCase();
    if (
      lc === "lead" ||
      lc === "marketingqualifiedlead" ||
      lc === "salesqualifiedlead"
    ) {
      return { status: "new", dealStage: null };
    }
    if (lc === "opportunity") {
      return { status: "open", dealStage: null };
    }
    if (lc === "customer") {
      return { status: "closed_won", dealStage: null };
    }
  }
  return { status: "none", dealStage: null };
}

// ---------------------------------------------------------------------------
// getHubSpotStatus — company search by domain → deals → status
// ---------------------------------------------------------------------------

export async function getHubSpotStatus(
  domain: string
): Promise<HubSpotStatusResult> {
  const normalized = normalizeDomain(domain);
  const cacheKey = `hubspot:status:${normalized}`;

  const cached = await getCached<HubSpotStatusResult>(cacheKey);
  if (cached) return cached;

  if (!isHubSpotAvailable()) {
    return { domain: normalized, status: "none", lastContact: null, dealStage: null };
  }

  try {
    // Step 1: Search for company by domain
    apiCallBreadcrumb("hubspot", "getStatus", { domain: normalized });
    const _statusStart = Date.now();
    const companyRes = await withRetry(
      async () => {
        const r = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`,
          {
            method: "POST",
            headers: hubspotHeaders(),
            body: JSON.stringify({
              filterGroups: [
                {
                  filters: [
                    { propertyName: "domain", operator: "EQ", value: normalized },
                  ],
                },
              ],
              properties: [
                "name",
                "domain",
                "lifecyclestage",
                "hs_lead_status",
                "num_associated_deals",
              ],
              limit: 1,
            }),
          }
        );
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "HubSpot", maxRetries: 2 }
    );

    const hsRateLimit = companyRes.headers.get("X-RateLimit-Remaining");
    logApiCall({
      source: "hubspot", endpoint: "companies/search", status_code: companyRes.status,
      success: companyRes.ok, latency_ms: Date.now() - _statusStart,
      rate_limit_remaining: hsRateLimit ? parseInt(hsRateLimit, 10) : null,
      error_message: null,
      context: { domain: normalized }, user_name: null,
    });

    const companyData = await companyRes.json();
    const companies = companyData.results || [];

    if (companies.length === 0) {
      const result: HubSpotStatusResult = {
        domain: normalized,
        status: "none",
        lastContact: null,
        dealStage: null,
      };
      await setCached(cacheKey, result, HUBSPOT_CACHE_TTL);
      return result;
    }

    const company = companies[0];
    const companyId = company.id;
    const lifecycleStage = company.properties?.lifecyclestage || null;

    // Step 2: Fetch associated deals
    let dealStages: string[] = [];
    let lastContact: string | null = null;

    try {
      const assocRes = await withRetry(
        async () => {
          const r = await fetch(
            `${HUBSPOT_BASE_URL}/crm/v3/objects/companies/${companyId}/associations/deals`,
            { headers: hubspotHeaders() }
          );
          if (!r.ok) throw new HttpError(r.status, r.statusText);
          return r;
        },
        { label: "HubSpot", maxRetries: 2 }
      ).catch(() => null);

      if (assocRes) {
        const assocData = await assocRes.json();
        const dealIds: string[] = (assocData.results || []).map(
          (r: { id: string }) => r.id
        );

        // Fetch deal details (batch up to 10)
        const dealFetches = dealIds.slice(0, 10).map(async (dealId) => {
          try {
            const dealRes = await withRetry(
              async () => {
                const r = await fetch(
                  `${HUBSPOT_BASE_URL}/crm/v3/objects/deals/${dealId}?properties=dealstage,dealname,amount,closedate`,
                  { headers: hubspotHeaders() }
                );
                if (!r.ok) throw new HttpError(r.status, r.statusText);
                return r;
              },
              { label: "HubSpot", maxRetries: 1 }
            );
            return dealRes.json();
          } catch {
            return null;
          }
        });

        const deals = (await Promise.all(dealFetches)).filter(Boolean);

        dealStages = deals
          .map((d) => d?.properties?.dealstage)
          .filter(Boolean) as string[];

        // Find most recent close date as proxy for last contact
        const closeDates = deals
          .map((d) => d?.properties?.closedate)
          .filter(Boolean) as string[];
        if (closeDates.length > 0) {
          closeDates.sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
          );
          lastContact = closeDates[0];
        }
      }
    } catch (err) {
      console.warn("[HubSpot] Failed to fetch deals for company:", err);
    }

    const derived = deriveStatus(lifecycleStage, dealStages);

    const result: HubSpotStatusResult = {
      domain: normalized,
      status: derived.status,
      lastContact,
      dealStage: derived.dealStage,
    };

    await setCached(cacheKey, result, HUBSPOT_CACHE_TTL);
    return result;
  } catch (err) {
    console.error("[HubSpot] getHubSpotStatus error:", err);
    return { domain: normalized, status: "none", lastContact: null, dealStage: null };
  }
}

// ---------------------------------------------------------------------------
// getHubSpotContacts — search contacts by company domain
// ---------------------------------------------------------------------------

export async function getHubSpotContacts(
  domain: string
): Promise<Contact[]> {
  const normalized = normalizeDomain(domain);
  const cacheKey = `hubspot:contacts:${normalized}`;

  const cached = await getCached<Contact[]>(cacheKey);
  if (cached) return cached;

  if (!isHubSpotAvailable()) return [];

  try {
    // First get the company name from a status call (which may be cached)
    // to use for contact search. Fall back to domain-based search.
    const status = await getHubSpotStatus(normalized);

    // Try searching contacts by company domain property
    apiCallBreadcrumb("hubspot", "getContacts", { domain: normalized });
    const _contactsStart = Date.now();
    const res = await withRetry(
      async () => {
        const r = await fetch(
          `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
          {
            method: "POST",
            headers: hubspotHeaders(),
            body: JSON.stringify({
              filterGroups: [
                {
                  filters: [
                    {
                      propertyName: "hs_additional_emails",
                      operator: "CONTAINS_TOKEN",
                      value: `*@${normalized}`,
                    },
                  ],
                },
                {
                  filters: [
                    {
                      propertyName: "email",
                      operator: "CONTAINS_TOKEN",
                      value: `*@${normalized}`,
                    },
                  ],
                },
              ],
              properties: [
                "firstname",
                "lastname",
                "email",
                "phone",
                "jobtitle",
                "hs_linkedin_url",
                "lastmodifieddate",
                "company",
              ],
              limit: 25,
            }),
          }
        );
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "HubSpot", maxRetries: 2 }
    );

    logApiCall({
      source: "hubspot", endpoint: "contacts/search", status_code: res.status,
      success: res.ok, latency_ms: Date.now() - _contactsStart,
      rate_limit_remaining: null, error_message: null,
      context: { domain: normalized }, user_name: null,
    });

    const data = await res.json();
    const results = data.results || [];
    apiCallBreadcrumb("hubspot", "getContacts complete", { domain: normalized, count: results.length });

    const contacts: Contact[] = results.map(
      (raw: Record<string, unknown>, i: number) => {
        const props = (raw.properties || {}) as Record<string, string | null>;
        const firstName = props.firstname || "";
        const lastName = props.lastname || "";

        return {
          id: `hubspot-${raw.id || i}`,
          companyDomain: normalized,
          companyName: props.company || normalized,
          firstName,
          lastName,
          title: props.jobtitle || "",
          email: props.email || null,
          phone: props.phone || null,
          linkedinUrl: props.hs_linkedin_url || null,
          emailConfidence: props.email ? 80 : 0,
          confidenceLevel: props.email ? "medium" : "none",
          sources: ["hubspot"] as Contact["sources"],
          seniority: mapSeniority(props.jobtitle),
          lastVerified: props.lastmodifieddate || null,
        } satisfies Contact;
      }
    );

    // If domain-based search returned nothing or few results, try company-association approach
    if (status.status !== "none") {
      if (contacts.length === 0) {
        return await getContactsViaCompanyAssociation(normalized);
      }
      // Supplement: also check company associations for contacts with different email domains
      try {
        const assocContacts = await getContactsViaCompanyAssociation(normalized);
        // Merge any new contacts not already found by domain search
        const existingEmails = new Set(contacts.filter((c) => c.email).map((c) => c.email!.toLowerCase()));
        const existingNames = new Set(contacts.map((c) => `${c.firstName.toLowerCase()}|${c.lastName.toLowerCase()}`));
        for (const ac of assocContacts) {
          const emailKey = ac.email?.toLowerCase();
          const nameKey = `${ac.firstName.toLowerCase()}|${ac.lastName.toLowerCase()}`;
          if ((!emailKey || !existingEmails.has(emailKey)) && !existingNames.has(nameKey)) {
            contacts.push(ac);
          }
        }
      } catch {
        // Association fallback is best-effort
      }
    }

    const sanitized = sanitizeContacts(contacts, normalized);
    await setCached(cacheKey, sanitized, HUBSPOT_CACHE_TTL);
    return sanitized;
  } catch (err) {
    console.error("[HubSpot] getHubSpotContacts error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fallback: get contacts via company → contact association
// ---------------------------------------------------------------------------

async function getContactsViaCompanyAssociation(
  domain: string
): Promise<Contact[]> {
  try {
    // Get company ID first
    let companyRes: Response;
    try {
      companyRes = await withRetry(
        async () => {
          const r = await fetch(
            `${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`,
            {
              method: "POST",
              headers: hubspotHeaders(),
              body: JSON.stringify({
                filterGroups: [
                  {
                    filters: [
                      { propertyName: "domain", operator: "EQ", value: domain },
                    ],
                  },
                ],
                properties: ["name"],
                limit: 1,
              }),
            }
          );
          if (!r.ok) throw new HttpError(r.status, r.statusText);
          return r;
        },
        { label: "HubSpot", maxRetries: 2 }
      );
    } catch {
      return [];
    }
    const companyData = await companyRes.json();
    if (!companyData.results?.length) return [];

    const companyId = companyData.results[0].id;
    const companyName = companyData.results[0].properties?.name || domain;

    // Get associated contacts
    let assocContactRes: Response;
    try {
      assocContactRes = await withRetry(
        async () => {
          const r = await fetch(
            `${HUBSPOT_BASE_URL}/crm/v3/objects/companies/${companyId}/associations/contacts`,
            { headers: hubspotHeaders() }
          );
          if (!r.ok) throw new HttpError(r.status, r.statusText);
          return r;
        },
        { label: "HubSpot", maxRetries: 2 }
      );
    } catch {
      return [];
    }
    const assocContactData = await assocContactRes.json();
    const contactIds: string[] = (assocContactData.results || [])
      .slice(0, 25)
      .map((r: { id: string }) => r.id);

    if (contactIds.length === 0) return [];

    // Batch fetch contact details
    let batchRes: Response;
    try {
      batchRes = await withRetry(
        async () => {
          const r = await fetch(
            `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/batch/read`,
            {
              method: "POST",
              headers: hubspotHeaders(),
              body: JSON.stringify({
                inputs: contactIds.map((id) => ({ id })),
                properties: [
                  "firstname",
                  "lastname",
                  "email",
                  "phone",
                  "jobtitle",
                  "hs_linkedin_url",
                  "lastmodifieddate",
                  "company",
                ],
              }),
            }
          );
          if (!r.ok) throw new HttpError(r.status, r.statusText);
          return r;
        },
        { label: "HubSpot", maxRetries: 2 }
      );
    } catch {
      return [];
    }
    const batchData = await batchRes.json();
    const results = batchData.results || [];

    const contacts: Contact[] = results.map(
      (raw: Record<string, unknown>, i: number) => {
        const props = (raw.properties || {}) as Record<string, string | null>;
        return {
          id: `hubspot-${raw.id || i}`,
          companyDomain: domain,
          companyName: props.company || companyName,
          firstName: props.firstname || "",
          lastName: props.lastname || "",
          title: props.jobtitle || "",
          email: props.email || null,
          phone: props.phone || null,
          linkedinUrl: props.hs_linkedin_url || null,
          emailConfidence: props.email ? 80 : 0,
          confidenceLevel: props.email ? "medium" : "none",
          sources: ["hubspot"] as Contact["sources"],
          seniority: mapSeniority(props.jobtitle),
          lastVerified: props.lastmodifieddate || null,
        } satisfies Contact;
      }
    );

    const sanitized = sanitizeContacts(contacts, domain);
    const cacheKey = `hubspot:contacts:${domain}`;
    await setCached(cacheKey, sanitized, HUBSPOT_CACHE_TTL);
    return sanitized;
  } catch (err) {
    console.error("[HubSpot] getContactsViaCompanyAssociation error:", err);
    return [];
  }
}
