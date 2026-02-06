# System Health Dashboard Implementation

**Date:** 2026-02-06
**Scope:** Sentry integration + Supabase health logging + Admin health dashboard + Contacts tab error handling

---

## Problem Solved

Contacts tab showed "No contacts available" after searches found companies, with zero explanation of what went wrong. Root causes:
1. Silent failures — HTTP errors swallowed silently
2. No persistent logging — `console.log` vanishes on Vercel
3. No health visibility — no way to know if APIs are failing or rate-limited

---

## What Was Implemented

### Part 1: Sentry Integration

**New files:**
- `instrumentation-client.ts` — Client-side Sentry init with session replay on errors
- `sentry.server.config.ts` — Server-side Sentry init
- `sentry.edge.config.ts` — Edge runtime Sentry init
- `instrumentation.ts` — Next.js instrumentation hook
- `src/app/global-error.tsx` — Root error boundary with Sentry capture
- `src/lib/sentry.ts` — `setSentryUser()` + `apiCallBreadcrumb()` helpers
- `src/components/SentryUserSync.tsx` — Syncs authenticated user to Sentry

**Edited files:**
- `next.config.ts` — Wrapped with `withSentryConfig()`, added tunnel route `/monitoring`
- `src/middleware.ts` — Added `/monitoring` to auth bypass list
- `src/app/error.tsx` — Added `Sentry.captureException()`
- `src/app/layout.tsx` — Added `<SentryUserSync />`

### Part 2: Supabase Health Logging

**New files:**
- `src/lib/navigator/health.ts` — `logApiCall()`, `trackExternalCall()`, `getHealthSummary()`
- `src/app/api/health/status/route.ts` — GET endpoint for health dashboard

**Required SQL migration (run in Supabase):**
```sql
CREATE TABLE api_health_log (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  endpoint text NOT NULL,
  status_code int,
  success boolean NOT NULL,
  latency_ms int,
  rate_limit_remaining int,
  error_message text,
  context jsonb,
  user_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ahl_source ON api_health_log (source, created_at DESC);
CREATE INDEX idx_ahl_errors ON api_health_log (success, created_at DESC);
```

### Part 3: Admin Health Dashboard

**New files:**
- `src/components/navigator/admin/health/HealthDashboard.tsx` — Status cards per source, error table, Sentry link

**Edited files:**
- `src/components/navigator/admin/AdminTabs.tsx` — Added "Health" tab (9th tab)
- `src/app/(navigator)/admin/page.tsx` — Wired `<HealthDashboard />` for health tab

### Part 4: Contacts Tab Error Handling Fixed

**Edited files:**
- `src/hooks/navigator/useContactsTab.ts` (line 166) — HTTP errors now mark domain as failed + fire toast
- `src/components/navigator/layout/ResultsList.tsx` — Context-aware empty state message
- `src/app/api/company/[domain]/contacts/route.ts` — Added `warning: "no_sources_returned"` field

### Part 5: Provider Instrumentation

**Edited files (breadcrumbs + health logging):**
- `src/lib/navigator/providers/exa.ts`
- `src/lib/navigator/providers/apollo.ts`
- `src/lib/navigator/providers/hubspot.ts`
- `src/lib/navigator/providers/freshsales.ts`
- `src/lib/navigator/llm/client.ts` (Groq + Gemini)

---

## Environment Variables

**Added to `.env.local`:**
```
NEXT_PUBLIC_SENTRY_DSN=https://907906ac6173ff7c15c6f6fc85cbe3dd@o4510834437652480.ingest.de.sentry.io/4510834454954064
```

**Required in Vercel (pending setup):**
```
NEXT_PUBLIC_SENTRY_DSN=<same as above>
SENTRY_ORG=myra-ai-ob
SENTRY_PROJECT=<create in Sentry dashboard>
SENTRY_AUTH_TOKEN=<generate at Sentry → Settings → Auth Tokens>
```

---

## Pending Setup

1. **Sentry project creation** — Create project in Sentry, get project slug
2. **Vercel env vars** — Add `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
3. **Supabase migration** — Run the SQL above to create `api_health_log` table

---

## Verification Steps

1. `npx tsc --noEmit` — Clean ✓
2. `npx next build` — Successful ✓
3. Trigger a search → Check Sentry dashboard for breadcrumbs
4. Kill Apollo API key → Search → Contacts tab shows error + retry button + toast
5. Open `/admin#health` → Verify status cards show per-source health
6. Check `api_health_log` table in Supabase has rows

---

## Files Summary

| # | File | Type |
|---|------|------|
| 1 | `instrumentation-client.ts` | NEW |
| 2 | `sentry.server.config.ts` | NEW |
| 3 | `sentry.edge.config.ts` | NEW |
| 4 | `instrumentation.ts` | NEW |
| 5 | `src/app/global-error.tsx` | NEW |
| 6 | `src/lib/sentry.ts` | NEW |
| 7 | `src/components/SentryUserSync.tsx` | NEW |
| 8 | `src/lib/navigator/health.ts` | NEW |
| 9 | `src/app/api/health/status/route.ts` | NEW |
| 10 | `src/components/navigator/admin/health/HealthDashboard.tsx` | NEW |
| 11 | `next.config.ts` | EDIT |
| 12 | `src/middleware.ts` | EDIT |
| 13 | `src/app/error.tsx` | EDIT |
| 14 | `src/app/layout.tsx` | EDIT |
| 15 | `src/components/navigator/admin/AdminTabs.tsx` | EDIT |
| 16 | `src/app/(navigator)/admin/page.tsx` | EDIT |
| 17 | `src/lib/navigator/providers/exa.ts` | EDIT |
| 18 | `src/lib/navigator/providers/apollo.ts` | EDIT |
| 19 | `src/lib/navigator/providers/hubspot.ts` | EDIT |
| 20 | `src/lib/navigator/providers/freshsales.ts` | EDIT |
| 21 | `src/lib/navigator/llm/client.ts` | EDIT |
| 22 | `src/hooks/navigator/useContactsTab.ts` | EDIT |
| 23 | `src/components/navigator/layout/ResultsList.tsx` | EDIT |
| 24 | `src/app/api/company/[domain]/contacts/route.ts` | EDIT |
