import type { Contact, FreshsalesIntel, FreshsalesStatus, FreshsalesDeal, FreshsalesActivity, FreshsalesSettings } from "../types";
import { getCached, setCached, CacheKeys, CacheTTL, normalizeDomain, getRootDomain } from "../../cache";
import { defaultFreshsalesSettings } from "../mock-data";
import { apiCallBreadcrumb } from "@/lib/sentry";
import { logApiCall } from "../health";
import { withRetry, HttpError } from "../retry";

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
    // Read from admin_config single-row table (id=global, column=freshsales_settings)
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (baseUrl && serviceKey) {
      const res = await fetch(
        `${baseUrl}/rest/v1/admin_config?id=eq.global&select=freshsales_settings`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0 && rows[0].freshsales_settings) {
          const db = rows[0].freshsales_settings as Record<string, unknown>;
          const settings: FreshsalesSettings = {
            ...defaultFreshsalesSettings,
            ...db,
            statusLabels: { ...defaultFreshsalesSettings.statusLabels, ...((db.statusLabels as Record<string, string>) ?? {}) },
            icpWeights: { ...defaultFreshsalesSettings.icpWeights, ...((db.icpWeights as Record<string, number>) ?? {}) },
            tagScoringRules: { ...defaultFreshsalesSettings.tagScoringRules, ...((db.tagScoringRules as Record<string, unknown>) ?? {}) } as FreshsalesSettings["tagScoringRules"],
          };
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

function contactBelongsToCompany(
  contact: Record<string, unknown>,
  targetDomain: string
): boolean {
  const email = contact.email as string | undefined;
  if (email) {
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!emailDomain) return false;
    return getRootDomain(emailDomain) === getRootDomain(targetDomain);
  }
  // No email — can't validate affiliation. Exclude to be safe.
  return false;
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

function checkRateLimit(headers: Headers, endpoint?: string): void {
  const remaining = headers.get("X-Ratelimit-Remaining");
  const remainingNum = remaining ? parseInt(remaining, 10) : null;
  if (remainingNum !== null && remainingNum < 100) {
    console.warn(`[Freshsales] Rate limit low: ${remaining} remaining`);
  }
  if (remainingNum !== null && endpoint) {
    logApiCall({
      source: "freshsales", endpoint, status_code: 200, success: true,
      latency_ms: null, rate_limit_remaining: remainingNum,
      error_message: null, context: null, user_name: null,
    });
  }
}

// ---------------------------------------------------------------------------
// Owner resolution cache (module-level, persists across requests within worker)
// ---------------------------------------------------------------------------

const _ownerCache = new Map<number, { name: string; email: string }>();

async function resolveOwner(
  baseUrl: string,
  ownerId: number
): Promise<{ id: number; name: string; email: string } | null> {
  if (_ownerCache.has(ownerId)) {
    const cached = _ownerCache.get(ownerId)!;
    return { id: ownerId, ...cached };
  }
  try {
    const res = await withRetry(
      async () => {
        const r = await fetch(`${baseUrl}/users/${ownerId}`, {
          headers: freshsalesHeaders(),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Freshsales", maxRetries: 2 }
    );
    checkRateLimit(res.headers);
    const data = await res.json();
    const owner = {
      name: data.user?.display_name || "Unknown",
      email: data.user?.email || "",
    };
    _ownerCache.set(ownerId, owner);
    return { id: ownerId, ...owner };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Paginated filtered_search — Freshsales returns 25 records/page
// ---------------------------------------------------------------------------

async function paginatedFilteredSearch(
  baseUrl: string,
  entity: string, // "contact" | "deal" | "sales_account"
  filterRule: unknown[],
  maxPages: number = 4 // Safety cap: 4 pages = 100 records max
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const _start = Date.now();
    let res: Response;
    try {
      res = await withRetry(
        async () => {
          const r = await fetch(
            `${baseUrl}/filtered_search/${entity}?page=${page}`,
            {
              method: "POST",
              headers: freshsalesHeaders(),
              body: JSON.stringify({ filter_rule: filterRule }),
            }
          );
          if (!r.ok) throw new HttpError(r.status, r.statusText);
          return r;
        },
        { label: "Freshsales", maxRetries: 2 }
      );
    } catch (err) {
      if (page === 1) {
        const status = err instanceof HttpError ? err.status : 0;
        console.warn(`[Freshsales] ${entity} search failed: ${status}`);
        logApiCall({
          source: "freshsales", endpoint: `filtered_search/${entity}`, status_code: status,
          success: false, latency_ms: Date.now() - _start, rate_limit_remaining: null,
          error_message: `${err instanceof HttpError ? err.status : err}`, context: { entity, page }, user_name: null,
        });
      }
      break;
    }
    checkRateLimit(res.headers, `filtered_search/${entity}`);
    let data: Record<string, unknown>;
    try { data = await res.json(); } catch { break; }
    // Entity key is plural: "contacts", "deals", "sales_accounts"
    const key = entity === "sales_account" ? "sales_accounts" : `${entity}s`;
    const items = (data[key] as unknown[]) ?? [];
    all.push(...(items as Record<string, unknown>[]));
    if (items.length < 25) break; // Last page
  }
  return all;
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

    apiCallBreadcrumb("freshsales", "getFreshsalesIntel", { domain: normalized, companyName });

    // Step 1: Search for sales account by website/domain
    const accountFilterRule = [
      {
        attribute: "website",
        operator: "contains",
        value: getRootDomain(normalized),
      },
    ];
    const accounts = await paginatedFilteredSearch(baseUrl, "sales_account", accountFilterRule, 1) as unknown[];

    if (accounts.length === 0) {
      // paginatedFilteredSearch logs warnings for page-1 failures
    }

    if (accounts.length === 0 && companyName) {
      // Fallback: search by company name
      // domain search empty, trying name fallback
      const nameFilterRule = [
        {
          attribute: "name",
          operator: "contains",
          value: companyName,
        },
      ];
      const nameAccounts = await paginatedFilteredSearch(baseUrl, "sales_account", nameFilterRule, 1);
      if (nameAccounts.length > 0) {
        accounts.push(...nameAccounts);
      }
    }

    if (accounts.length === 0) {
      // Last resort: direct contact search by company name (no account match needed)
      if (companyName) {
        const directContacts = await fetchFreshsalesContactsByCompanyName(baseUrl, companyName, normalized);
        if (directContacts.length > 0) {
          const result: FreshsalesIntel = {
            domain: normalized,
            status: "none",
            account: null,
            contacts: directContacts,
            deals: [],
            recentActivity: [],
            lastContactDate: null,
            fetchedAt: new Date().toISOString(),
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

    // Step 2: Parallel fetch contacts + deals + activities
    const [contactsData, dealsData, activitiesData] = await Promise.all([
      fetchFreshsalesContacts(baseUrl, accountId, normalized),
      fetchFreshsalesDeals(baseUrl, accountId),
      fetchFreshsalesActivities(baseUrl, accountId),
    ]);

    // Resolve account owner
    const ownerId = account.owner_id as number | undefined;
    const accountOwner = ownerId ? await resolveOwner(baseUrl, ownerId) : null;

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


    // Derive last contact date — prefer activity date, fall back to contact.lastVerified
    let lastContactDate: string | null = null;
    if (activitiesData.length > 0) {
      lastContactDate = activitiesData[0].date; // already sorted desc
    } else if (taggedContacts.length > 0) {
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
        owner: accountOwner,
      },
      contacts: taggedContacts,
      deals: dealsData,
      recentActivity: activitiesData,
      lastContactDate,
      fetchedAt: new Date().toISOString(),
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
    const filterRule = [
      {
        attribute: "sales_account_id",
        operator: "is_in",
        value: accountId,
      },
    ];
    const rawContacts = await paginatedFilteredSearch(baseUrl, "contact", filterRule, 4);
    const validated = rawContacts.filter((raw) => contactBelongsToCompany(raw, domain));

    // Freshsales contacts are CRM records — do NOT run sanitizeContacts on them.
    // sanitizeContacts filters out contacts whose email domain matches the company
    // domain, which is exactly wrong for CRM data (we want our known contacts AT
    // the company).
    const contacts: Contact[] = validated.map(
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
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
        freshsalesOwnerId: (raw.owner_id as number) || undefined,
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
    const filterRule = [
      {
        attribute: "company_name",
        operator: "contains",
        value: companyName,
      },
    ];
    const rawContacts = await paginatedFilteredSearch(baseUrl, "contact", filterRule, 4);
    const validated = rawContacts.filter((raw) => contactBelongsToCompany(raw, domain));

    return validated.map(
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
    const filterRule = [
      {
        attribute: "sales_account_id",
        operator: "is_in",
        value: accountId,
      },
    ];
    const rawDeals = await paginatedFilteredSearch(baseUrl, "deal", filterRule, 4);

    return rawDeals.map((raw: Record<string, unknown>) => {
      const updatedAt = (raw.updated_at as string) || null;
      const daysInStage = updatedAt
        ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: raw.id as number,
        name: (raw.name as string) || "Untitled Deal",
        amount: (raw.amount as number) || null,
        stage: (raw.deal_stage as Record<string, unknown>)?.name as string
          || (raw.deal_stage_id as string)
          || "Unknown",
        probability: (raw.probability as number) || null,
        expectedClose: (raw.expected_close as string) || null,
        createdAt: (raw.created_at as string) || null,
        updatedAt,
        daysInStage,
        lostReason: (raw.lost_reason as string) || null,
      };
    });
  } catch (err) {
    console.error("[Freshsales] fetchFreshsalesDeals error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch activities by sales_account_id
// ---------------------------------------------------------------------------

async function fetchFreshsalesActivities(
  baseUrl: string,
  accountId: number,
  maxPages = 2
): Promise<FreshsalesActivity[]> {
  try {
    const filterRule = [
      {
        attribute: "targetable_id",
        operator: "is_in",
        value: accountId,
      },
    ];
    const rawActivities = await paginatedFilteredSearch(
      baseUrl,
      "sales_activity",
      filterRule,
      maxPages
    );

    const activities: FreshsalesActivity[] = rawActivities
      .map((raw: Record<string, unknown>) => ({
        type: (raw.activity_type as string) || (raw.type as string) || "note",
        title: (raw.notes as string) || (raw.title as string) || "",
        date: (raw.created_at as string) || "",
        actor:
          (raw.owner as Record<string, unknown>)?.display_name as string ||
          (raw.created_by as string) ||
          "Unknown",
        outcome: (raw.outcome as string) || undefined,
        contactName: (raw.targetable as Record<string, unknown>)?.name as string || undefined,
      }))
      .filter((a) => a.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return activities;
  } catch (err) {
    console.error("[Freshsales] fetchFreshsalesActivities error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export async function createFreshsalesContact(
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    title?: string;
    linkedinUrl?: string;
  },
  accountId: number
): Promise<{ id: number } | null> {
  const settings = await getFreshsalesConfig();
  const baseUrl = getBaseUrl(settings);
  try {
    const res = await withRetry(
      async () => {
        const r = await fetch(`${baseUrl}/contacts`, {
          method: "POST",
          headers: freshsalesHeaders(),
          body: JSON.stringify({
            contact: {
              first_name: contact.firstName,
              last_name: contact.lastName,
              email: contact.email,
              mobile_number: contact.phone,
              job_title: contact.title,
              linkedin: contact.linkedinUrl,
              sales_account_id: accountId,
            },
          }),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Freshsales", maxRetries: 2 }
    );
    checkRateLimit(res.headers);
    const data = await res.json();
    return { id: data.contact?.id };
  } catch (err) {
    console.error("[Freshsales] createContact error:", err);
    return null;
  }
}

export async function findOrCreateAccount(
  domain: string,
  companyName: string
): Promise<{ id: number; created: boolean } | null> {
  const settings = await getFreshsalesConfig();
  const baseUrl = getBaseUrl(settings);
  try {
    // 1. Search existing by domain
    const filterRule = [
      { attribute: "website", operator: "contains", value: domain },
    ];
    const accounts = await paginatedFilteredSearch(baseUrl, "sales_account", filterRule, 1);
    if (accounts.length > 0) {
      return { id: accounts[0].id as number, created: false };
    }

    // 2. Create new account
    const res = await withRetry(
      async () => {
        const r = await fetch(`${baseUrl}/sales_accounts`, {
          method: "POST",
          headers: freshsalesHeaders(),
          body: JSON.stringify({
            sales_account: {
              name: companyName,
              website: `https://${domain}`,
            },
          }),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Freshsales", maxRetries: 2 }
    );
    checkRateLimit(res.headers);
    const data = await res.json();
    return { id: data.sales_account?.id, created: true };
  } catch (err) {
    console.error("[Freshsales] findOrCreateAccount error:", err);
    return null;
  }
}

export async function createFreshsalesTask(
  task: {
    title: string;
    description?: string;
    dueDate: string;
    targetableType: "Contact" | "SalesAccount";
    targetableId: number;
    ownerId?: number;
  }
): Promise<{ id: number } | null> {
  const settings = await getFreshsalesConfig();
  const baseUrl = getBaseUrl(settings);
  try {
    const res = await withRetry(
      async () => {
        const r = await fetch(`${baseUrl}/tasks`, {
          method: "POST",
          headers: freshsalesHeaders(),
          body: JSON.stringify({
            task: {
              title: task.title,
              description: task.description || "",
              due_date: task.dueDate,
              owner_id: task.ownerId,
              targetable_type: task.targetableType,
              targetable_id: task.targetableId,
            },
          }),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Freshsales", maxRetries: 2 }
    );
    checkRateLimit(res.headers);
    const data = await res.json();
    return { id: data.task?.id };
  } catch (err) {
    console.error("[Freshsales] createTask error:", err);
    return null;
  }
}

export async function createFreshsalesActivity(
  activity: {
    title: string;
    notes?: string;
    targetableType: "Contact" | "SalesAccount";
    targetableId: number;
    ownerId?: number;
  }
): Promise<{ id: number } | null> {
  const settings = await getFreshsalesConfig();
  const baseUrl = getBaseUrl(settings);
  try {
    const res = await withRetry(
      async () => {
        const r = await fetch(`${baseUrl}/sales_activities`, {
          method: "POST",
          headers: freshsalesHeaders(),
          body: JSON.stringify({
            sales_activity: {
              title: activity.title,
              notes: activity.notes || "",
              targetable_type: activity.targetableType,
              targetable_id: activity.targetableId,
              owner_id: activity.ownerId,
            },
          }),
        });
        if (!r.ok) throw new HttpError(r.status, r.statusText);
        return r;
      },
      { label: "Freshsales", maxRetries: 2 }
    );
    checkRateLimit(res.headers);
    const data = await res.json();
    return { id: data.sales_activity?.id };
  } catch (err) {
    console.error("[Freshsales] createActivity error:", err);
    return null;
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

// ---------------------------------------------------------------------------
// Peer companies — find accounts in the same industry
// ---------------------------------------------------------------------------

export async function getFreshsalesPeers(
  industry: string,
  excludeDomain: string,
  limit: number = 10,
  options?: { minSize?: number; maxSize?: number; region?: string }
): Promise<FreshsalesIntel[]> {
  const settings = await getFreshsalesConfig();
  if (!isFreshsalesAvailable(settings)) return [];

  const baseUrl = getBaseUrl(settings);
  try {
    const filterRule: unknown[] = [
      { attribute: "industry_type", operator: "contains", value: industry },
    ];

    // Optional: filter by employee count range
    if (options?.minSize != null) {
      filterRule.push({
        attribute: "number_of_employees",
        operator: "is_greater_than",
        value: options.minSize,
      });
    }
    if (options?.maxSize != null) {
      filterRule.push({
        attribute: "number_of_employees",
        operator: "is_less_than",
        value: options.maxSize,
      });
    }

    // Optional: filter by region/country
    if (options?.region) {
      filterRule.push({
        attribute: "territory",
        operator: "contains",
        value: options.region,
      });
    }

    const accounts = await paginatedFilteredSearch(baseUrl, "sales_account", filterRule, 2);

    // Filter out the source company and limit results
    const excludeNorm = normalizeDomain(excludeDomain);
    const filtered = accounts
      .filter((acc) => {
        const website = (acc.website as string) || "";
        const accDomain = normalizeDomain(website.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
        return accDomain !== excludeNorm;
      })
      .slice(0, limit);

    // Convert to lightweight FreshsalesIntel (no contacts/deals/activities fetch)
    return filtered.map((acc) => {
      const website = (acc.website as string) || "";
      const domain = getRootDomain(website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")) || "";
      return {
        domain,
        status: "new_lead" as FreshsalesStatus,
        account: {
          id: acc.id as number,
          name: (acc.name as string) || "",
          website: website || null,
          industry: (acc.industry_type as string) || industry,
          employees: (acc.number_of_employees as number) || null,
          owner: null,
          lastContacted: null,
        },
        contacts: [],
        deals: [],
        recentActivity: [],
        lastContactDate: null,
      };
    });
  } catch (err) {
    console.error("[Freshsales] getFreshsalesPeers error:", err);
    return [];
  }
}
