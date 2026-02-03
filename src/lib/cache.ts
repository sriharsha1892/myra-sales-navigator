/**
 * Cache layer — will use Vercel KV in production.
 * For now, uses in-memory Map with TTL.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>(key: string): Promise<T | null> {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export async function setCached<T>(key: string, data: T, ttlMinutes: number): Promise<void> {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  });
}

export async function clearCache(): Promise<void> {
  memoryCache.clear();
}

export async function deleteCached(key: string): Promise<void> {
  memoryCache.delete(key);
}

// ---------------------------------------------------------------------------
// Domain normalization
// ---------------------------------------------------------------------------

export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "").trim();
}

// ---------------------------------------------------------------------------
// Cache key builders
// ---------------------------------------------------------------------------

export const CacheKeys = {
  search: (hash: string) => `search:${hash}`,
  company: (domain: string) => `company:${normalizeDomain(domain)}`,
  contacts: (domain: string) => `contacts:${normalizeDomain(domain)}`,
  signals: (domain: string) => `signals:${normalizeDomain(domain)}`,
  email: (email: string) => `email:${email.toLowerCase().trim()}`,
  hubspot: (domain: string) => `hubspot:${normalizeDomain(domain)}`,
  freshsales: (domain: string) => `freshsales:intel:${normalizeDomain(domain)}`,
  enrichedContacts: (domain: string) => `enriched:contacts:${normalizeDomain(domain)}`,
} as const;

// ---------------------------------------------------------------------------
// Cache TTL constants (in minutes)
// ---------------------------------------------------------------------------

export const CacheTTL = {
  search: 60,
  company: 120,
  contacts: 120,
  signals: 60,
  email: 1440,   // 24 hours (Clearout verification)
  hubspot: 30,
  freshsales: 30,
  enrichedContacts: 120, // 2 hours
} as const;

// ---------------------------------------------------------------------------
// Stable hash for search filter cache keys
// ---------------------------------------------------------------------------

export function hashFilters(filters: Record<string, unknown>): string {
  const sorted = JSON.stringify(filters, Object.keys(filters).sort());
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
