import type { Contact, FreshsalesIntel, FreshsalesStatus, FreshsalesDeal, FreshsalesActivity, FreshsalesSettings } from "../types";
import { getCached, setCached, CacheKeys, CacheTTL, normalizeDomain } from "../cache";
import { sanitizeContacts } from "./hubspot";
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
  domain: string
): Promise<FreshsalesIntel> {
  const normalized = normalizeDomain(domain);
  const cacheKey = CacheKeys.freshsales(normalized);

  const cached = await getCached<FreshsalesIntel>(cacheKey);
  if (cached) return cached;

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
      const result = EMPTY_INTEL(normalized);
      await setCached(cacheKey, result, cacheTtl);
      return result;
    }

    checkRateLimit(accountRes.headers);
    const accountData = await accountRes.json();
    const accounts = accountData.sales_accounts ?? [];

    if (accounts.length === 0) {
      const result = EMPTY_INTEL(normalized);
      await setCached(cacheKey, result, cacheTtl);
      return result;
    }

    const account = accounts[0];
    const accountId = account.id;

    // Step 2: Parallel fetch contacts + deals
    const [contactsData, dealsData] = await Promise.all([
      fetchFreshsalesContacts(baseUrl, accountId, normalized),
      fetchFreshsalesDeals(baseUrl, accountId),
    ]);

    const status = dealsData.length > 0
      ? deriveStatus(dealsData)
      : "new_lead";

    // Derive last contact date from most recent activity or deal
    let lastContactDate: string | null = null;
    if (contactsData.length > 0) {
      const verified = contactsData
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
        name: account.name || normalized,
        website: account.website || null,
        industry: account.industry_type?.name || account.industry_type || null,
        employees: account.number_of_employees || null,
      },
      contacts: contactsData,
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
    const data = await res.json();
    const rawContacts = data.contacts ?? [];

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

    return sanitizeContacts(contacts, domain);
  } catch (err) {
    console.error("[Freshsales] fetchFreshsalesContacts error:", err);
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
    const data = await res.json();
    const rawDeals = data.deals ?? [];

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

export async function getFreshsalesContacts(domain: string): Promise<Contact[]> {
  const intel = await getFreshsalesIntel(domain);
  return intel.contacts;
}

export async function getFreshsalesStatus(domain: string): Promise<FreshsalesStatus> {
  const intel = await getFreshsalesIntel(domain);
  return intel.status;
}
