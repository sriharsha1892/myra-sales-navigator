import type { Contact, FreshsalesIntel, FreshsalesStatus, FreshsalesDeal, FreshsalesActivity, FreshsalesSettings } from "../types";
import { getCached, setCached, CacheKeys, CacheTTL, normalizeDomain } from "../cache";
import { defaultFreshsalesSettings } from "../mock-data";

// ---------------------------------------------------------------------------
// Admin config access (server-side)
// ---------------------------------------------------------------------------

let _settingsCache: { settings: FreshsalesSettings; fetchedAt: number } | null = null;
const SETTINGS_CACHE_MS = 60_000; // re-read every 60s

async function getFreshsalesConfig(): Promise<FreshsalesSettings> {
  if (_settingsCache && Date.now() - _settingsCache.fetchedAt < SETTINGS_CACHE_MS) {
    return _settingsCache.settings;
  }
  try {
    // Try reading from Supabase admin_config via internal fetch
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (baseUrl && serviceKey) {
      const res = await fetch(
        `${baseUrl}/rest/v1/admin_config?key=eq.freshsalesSettings&select=value`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0 && rows[0].value) {
          const settings = rows[0].value as FreshsalesSettings;
          _settingsCache = { settings, fetchedAt: Date.now() };
          return settings;
        }
      }
    }
  } catch {
    // fall through to defaults
  }
  return defaultFreshsalesSettings;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isFreshsalesAvailable(settings?: FreshsalesSettings): boolean {
  const enabled = settings?.enabled ?? true;
  const hasDomain = !!(settings?.domain || process.env.FRESHSALES_DOMAIN);
  return enabled && !!process.env.FRESHSALES_API_KEY && hasDomain;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshsalesHeaders(): Record<string, string> {
  return {
    Authorization: `Token token=${process.env.FRESHSALES_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function getBaseUrl(settings?: FreshsalesSettings): string {
  const domain = settings?.domain || process.env.FRESHSALES_DOMAIN;
  return `https://${domain}.freshsales.io/api`;
}

function mapSeniority(title: string | null | undefined): Contact["seniority"] {
  if (!title) return "staff";
  const t = title.toLowerCase();
  // Check director before c_level keywords — "director" contains "cto" as substring
  if (t.includes("director")) return "director";
  if (
    /\bceo\b/.test(t) ||
    /\bcto\b/.test(t) ||
    /\bcfo\b/.test(t) ||
    /\bcoo\b/.test(t) ||
    t.includes("chief") ||
    t.includes("founder") ||
    t.includes("owner")
  )
    return "c_level";
  if (/\bvp\b/.test(t) || t.includes("vice president")) return "vp";
  if (t.includes("manager") || t.includes("head of")) return "manager";
  return "staff";
}

function checkRateLimit(headers: Headers): void {
  const remaining = headers.get("X-Ratelimit-Remaining");
  if (remaining && parseInt(remaining, 10) < 100) {
    console.warn(`[Freshsales] Rate limit low: ${remaining} remaining`);
  }
}

function deriveStatus(deals: FreshsalesDeal[]): FreshsalesStatus {
  if (deals.length === 0) return "new_lead";

  for (const deal of deals) {
    const stage = deal.stage.toLowerCase();
    if (stage === "won" || stage === "closed won" || stage === "closedwon") return "won";
  }
  for (const deal of deals) {
    const stage = deal.stage.toLowerCase();
    if (stage === "lost" || stage === "closed lost" || stage === "closedlost") return "lost";
  }

  // Any active deal → negotiation
  return "negotiation";
}

// ---------------------------------------------------------------------------
// Main orchestrator — getFreshsalesIntel
// ---------------------------------------------------------------------------

const EMPTY_INTEL = (domain: string): FreshsalesIntel => ({
  domain,
  status: "none",
  account: null,
  contacts: [],
  deals: [],
  recentActivity: [],
  lastContactDate: null,
});

export async function getFreshsalesIntel(
  domain: string,
  companyName?: string
): Promise<FreshsalesIntel> {
  const normalized = normalizeDomain(domain);
  // Cache key encodes whether name-fallback was available, so a domain-only
  // lookup doesn't shadow a later domain+name lookup.
  const cacheKey = companyName
    ? CacheKeys.freshsales(`${normalized}:${companyName}`)
    : CacheKeys.freshsales(normalized);

  const cached = await getCached<FreshsalesIntel>(cacheKey);
  if (cached) {
    // Positive results: always return from cache
    if (cached.status !== "none") return cached;
    // Empty result cached WITH companyName (full search exhausted): return it
    if (companyName) return cached;
    // Empty result from domain-only search: skip cache — a call with
    // companyName might find the account via name fallback.
  }

  const settings = await getFreshsalesConfig();

  if (!isFreshsalesAvailable(settings)) return EMPTY_INTEL(normalized);

  const cacheTtl = settings.cacheTtlMinutes ?? CacheTTL.freshsales;

  try {
    const baseUrl = getBaseUrl(settings);

    // Step 1: Search for sales account by website/domain
    const accountRes = await fetch(`${baseUrl}/filtered_search/sales_account`, {
      method: "POST",
      headers: freshsalesHeaders(),
      body: JSON.stringify({
        filter_rule: [
          {
            attribute: "website",
            operator: "contains",
            value: normalized,
          },
        ],
      }),
    });

    if (!accountRes.ok) {
      console.warn(
        `[Freshsales] Account search failed for ${normalized}: ${accountRes.status}`
      );
      // Don't cache failures — transient errors shouldn't block retries
      return EMPTY_INTEL(normalized);
    }

    checkRateLimit(accountRes.headers);
    let accountData: Record<string, unknown>;
    try {
      accountData = await accountRes.json();
    } catch {
      console.error("[Freshsales] Malformed JSON in account search response");
      return EMPTY_INTEL(normalized);
    }
    const accounts = (accountData.sales_accounts as unknown[]) ?? [];

    if (accounts.length === 0 && companyName) {
      // Fallback: search by company name
      console.log("[Freshsales] domain search empty, trying name fallback:", companyName);
      const nameRes = await fetch(`${baseUrl}/filtered_search/sales_account`, {
        method: "POST",
        headers: freshsalesHeaders(),
        body: JSON.stringify({
          filter_rule: [
            {
              attribute: "name",
              operator: "contains",
              value: companyName,
            },
          ],
        }),
      });

      if (nameRes.ok) {
        checkRateLimit(nameRes.headers);
        try {
          const nameData = await nameRes.json();
          const nameAccounts = nameData.sales_accounts ?? [];
          if (nameAccounts.length > 0) {
            accounts.push(...nameAccounts);
          }
        } catch {
          console.error("[Freshsales] Malformed JSON in name fallback response");
        }
      }
    }

    if (accounts.length === 0) {
      // Last resort: direct contact search by company name (no account match needed)
      if (companyName) {
        const directContacts = await fetchFreshsalesContactsByCompanyName(baseUrl, companyName, normalized);
        if (directContacts.length > 0) {
          console.log(`[Freshsales] Found ${directContacts.length} contacts via direct company_name search for "${companyName}"`);
          const result: FreshsalesIntel = {
            domain: normalized,
            status: "none",
            account: null,
            contacts: directContacts,
            deals: [],
            recentActivity: [],
            lastContactDate: null,
          };
          await setCached(cacheKey, result, cacheTtl);
          return result;
        }
      }
      const result = EMPTY_INTEL(normalized);
      // Only cache empty results if companyName was provided (exhausted all search paths).
      // Without companyName, a subsequent call with name might find the account.
      if (companyName) {
        await setCached(cacheKey, result, cacheTtl);
      }
      return result;
    }

    if (accounts.length > 1) {
      console.warn(`[Freshsales] ${accounts.length} accounts found for ${normalized}, using first`);
    }

    const account = accounts[0] as Record<string, unknown>;
    const accountId = account.id as number;

    // Step 2: Parallel fetch contacts + deals
    const [contactsData, dealsData] = await Promise.all([
      fetchFreshsalesContacts(baseUrl, accountId, normalized),
      fetchFreshsalesDeals(baseUrl, accountId),
    ]);

    const status = dealsData.length > 0
      ? deriveStatus(dealsData)
      : "new_lead";

    // Tag contacts with CRM status derived from deals (immutable — map to new objects)
    const crmStatusLabel: Record<FreshsalesStatus, string> = {
      none: "",
      new_lead: "New Lead",
      contacted: "Contacted",
      negotiation: "Negotiation",
      won: "Customer",
      lost: "Lost",
      customer: "Customer",
    };
    const statusTag = crmStatusLabel[status] || "";
    const taggedContacts = statusTag
      ? contactsData.map((c) => ({ ...c, crmStatus: statusTag }))
      : contactsData;

    // Derive last contact date from most recent activity or deal
    let lastContactDate: string | null = null;
    if (taggedContacts.length > 0) {
      const verified = taggedContacts
        .map((c) => c.lastVerified)
        .filter(Boolean) as string[];
      if (verified.length > 0) {
        verified.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        lastContactDate = verified[0];
      }
    }

    const result: FreshsalesIntel = {
      domain: normalized,
      status,
      account: {
        id: accountId,
        name: (account.name as string) || normalized,
        website: (account.website as string) || null,
        industry: (account.industry_type as Record<string, unknown>)?.name as string
          || (account.industry_type as string)
          || null,
        employees: (account.number_of_employees as number) || null,
      },
      contacts: taggedContacts,
      deals: dealsData,
      recentActivity: [], // Activity fetch can be added later if needed
      lastContactDate,
    };

    await setCached(cacheKey, result, cacheTtl);
    return result;
  } catch (err) {
    console.error("[Freshsales] getFreshsalesIntel error:", err);
    return EMPTY_INTEL(normalized);
  }
}

// ---------------------------------------------------------------------------
// Fetch contacts by sales_account_id
// ---------------------------------------------------------------------------

async function fetchFreshsalesContacts(
  baseUrl: string,
  accountId: number,
  domain: string
): Promise<Contact[]> {
  try {
    const res = await fetch(`${baseUrl}/filtered_search/contact`, {
      method: "POST",
      headers: freshsalesHeaders(),
      body: JSON.stringify({
        filter_rule: [
          {
            attribute: "sales_account_id",
            operator: "is_in",
            value: accountId,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[Freshsales] Contact search failed: ${res.status}`);
      return [];
    }

    checkRateLimit(res.headers);
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      console.error("[Freshsales] Malformed JSON in contacts response");
      return [];
    }
    const rawContacts = (data.contacts as Record<string, unknown>[]) ?? [];

    // Freshsales contacts are CRM records — do NOT run sanitizeContacts on them.
    // sanitizeContacts filters out contacts whose email domain matches the company
    // domain, which is exactly wrong for CRM data (we want our known contacts AT
    // the company).
    const contacts: Contact[] = rawContacts.map(
      (raw: Record<string, unknown>, i: number) => ({
        id: `freshsales-${raw.id || i}`,
        companyDomain: domain,
        companyName: (raw.company as Record<string, unknown>)?.name as string || domain,
        firstName: (raw.first_name as string) || "",
        lastName: (raw.last_name as string) || "",
        title: (raw.job_title as string) || "",
        email: (raw.email as string) || null,
        phone: (raw.mobile_number as string) || (raw.work_number as string) || null,
        linkedinUrl: (raw.linkedin as string) || null,
        emailConfidence: raw.email ? 75 : 0,
        confidenceLevel: raw.email ? "medium" : "none",
        sources: ["freshsales"] as Contact["sources"],
        seniority: mapSeniority(raw.job_title as string),
        lastVerified: (raw.updated_at as string) || null,
      })
    );

    return contacts;
  } catch (err) {
    console.error("[Freshsales] fetchFreshsalesContacts error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch contacts by company_name (no account match needed)
// ---------------------------------------------------------------------------

async function fetchFreshsalesContactsByCompanyName(
  baseUrl: string,
  companyName: string,
  domain: string
): Promise<Contact[]> {
  try {
    const res = await fetch(`${baseUrl}/filtered_search/contact`, {
      method: "POST",
      headers: freshsalesHeaders(),
      body: JSON.stringify({
        filter_rule: [
          {
            attribute: "company_name",
            operator: "contains",
            value: companyName,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[Freshsales] Direct contact search failed: ${res.status}`);
      return [];
    }

    checkRateLimit(res.headers);
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      console.error("[Freshsales] Malformed JSON in direct contact search response");
      return [];
    }
    const rawContacts = (data.contacts as Record<string, unknown>[]) ?? [];

    return rawContacts.map(
      (raw: Record<string, unknown>, i: number) => ({
        id: `freshsales-${raw.id || i}`,
        companyDomain: domain,
        companyName: (raw.company as Record<string, unknown>)?.name as string || companyName,
        firstName: (raw.first_name as string) || "",
        lastName: (raw.last_name as string) || "",
        title: (raw.job_title as string) || "",
        email: (raw.email as string) || null,
        phone: (raw.mobile_number as string) || (raw.work_number as string) || null,
        linkedinUrl: (raw.linkedin as string) || null,
        emailConfidence: raw.email ? 75 : 0,
        confidenceLevel: raw.email ? "medium" : "none",
        sources: ["freshsales"] as Contact["sources"],
        seniority: mapSeniority(raw.job_title as string),
        lastVerified: (raw.updated_at as string) || null,
      })
    );
  } catch (err) {
    console.error("[Freshsales] fetchFreshsalesContactsByCompanyName error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch deals by sales_account_id
// ---------------------------------------------------------------------------

async function fetchFreshsalesDeals(
  baseUrl: string,
  accountId: number
): Promise<FreshsalesDeal[]> {
  try {
    const res = await fetch(`${baseUrl}/filtered_search/deal`, {
      method: "POST",
      headers: freshsalesHeaders(),
      body: JSON.stringify({
        filter_rule: [
          {
            attribute: "sales_account_id",
            operator: "is_in",
            value: accountId,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn(`[Freshsales] Deal search failed: ${res.status}`);
      return [];
    }

    checkRateLimit(res.headers);
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      console.error("[Freshsales] Malformed JSON in deals response");
      return [];
    }
    const rawDeals = (data.deals as Record<string, unknown>[]) ?? [];

    return rawDeals.map((raw: Record<string, unknown>) => ({
      id: raw.id as number,
      name: (raw.name as string) || "Untitled Deal",
      amount: (raw.amount as number) || null,
      stage: (raw.deal_stage as Record<string, unknown>)?.name as string
        || (raw.deal_stage_id as string)
        || "Unknown",
      probability: (raw.probability as number) || null,
      expectedClose: (raw.expected_close as string) || null,
    }));
  } catch (err) {
    console.error("[Freshsales] fetchFreshsalesDeals error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Thin wrappers
// ---------------------------------------------------------------------------

export async function getFreshsalesContacts(domain: string, companyName?: string): Promise<Contact[]> {
  const intel = await getFreshsalesIntel(domain, companyName);
  return intel.contacts;
}

export async function getFreshsalesStatus(domain: string, companyName?: string): Promise<FreshsalesStatus> {
  const intel = await getFreshsalesIntel(domain, companyName);
  return intel.status;
}
