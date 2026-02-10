/**
 * Centralized cache TTL values (in minutes).
 *
 * Every setCached() call in the codebase should reference a value from here
 * rather than hardcoding a magic number. This makes it trivial to tune cache
 * lifetimes across all providers from one place.
 *
 * The admin_config table can override some of these at runtime (e.g.
 * freshsalesSettings.cacheTtlMinutes), but these serve as compile-time defaults.
 */

export const CACHE_TTLS = {
  // ---------------------------------------------------------------------------
  // Search engines
  // ---------------------------------------------------------------------------
  exaSearch: 360,           // 6 hours — Exa search results
  serperSearch: 360,        // 6 hours — Serper search results
  parallelSearch: 360,      // 6 hours — Parallel search results

  // ---------------------------------------------------------------------------
  // Provider data
  // ---------------------------------------------------------------------------
  apolloPerson: 1440,       // 24 hours — Apollo person enrichment (credit-bearing)
  apolloContacts: 120,      // 2 hours  — Apollo contacts list (free endpoint)
  hubspot: 60,              // 1 hour   — HubSpot contacts/status/deals
  freshsales: 30,           // 30 min   — Freshsales intel (admin-overridable)
  clearout: 30 * 24 * 60,   // 30 days  — Clearout email verification

  // ---------------------------------------------------------------------------
  // Composite / route-level
  // ---------------------------------------------------------------------------
  enrichedContacts: 120,    // 2 hours  — merged + enriched contacts per domain
  company: 120,             // 2 hours  — company dossier
  search: 60,               // 1 hour   — generic search
  signals: 60,              // 1 hour   — signal extraction
  email: 1440,              // 24 hours — email verification (same as apolloPerson)

  // ---------------------------------------------------------------------------
  // LLM / AI
  // ---------------------------------------------------------------------------
  aiSummary: 360,           // 6 hours  — AI-generated company summary
  queryReformulation: 360,  // 6 hours  — LLM query reformulation cache
  signalExtraction: 360,    // 6 hours  — Exa signal extraction cache

  // ---------------------------------------------------------------------------
  // Admin config caches
  // ---------------------------------------------------------------------------
  adminConfig: 60,          // 1 hour   — admin config rows (icp-weights, enrichment-limits, email_prompts)
  peers: 60,                // 1 hour   — peer companies
} as const;
