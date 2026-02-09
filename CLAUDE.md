# FOR SRIHARSHA — myRA Sales Navigator

> A prospect qualification workbench that consolidates Apollo, HubSpot, Exa, and Clearout into a single dark-mode command center. Built so an 8–10 person sales team can identify, qualify, and act on prospects 60% faster than their current multi-tab chaos.

**This is not a CRM. This is not an Apollo clone. This is a command center for revenue intelligence.**

---

## What This Project Actually Is

Imagine your sales team opens their laptop every morning and immediately fractures their attention across six tabs: Apollo for prospecting, ZoomInfo for enrichment, HubSpot for relationship history, LinkedIn for social context, Google Sheets for exclusion lists, and ask-myra.ai for writing emails. They spend hours cross-referencing contacts, checking if someone's already a customer, and building context from disconnected sources.

Sales Navigator kills that workflow. One interface: apply filters, get a qualified list, click a company, see its full dossier with contacts and signals, copy what you need, move on. The team should be able to identify 50 qualified prospects per week instead of 20. If they still feel the need to open Apollo separately, we failed.

The secret weapon is **Exa** — a neural search engine that understands semantic meaning. While Apollo gives you static firmographic data, Exa can answer queries like "mid-size food ingredients companies expanding to Asia Pacific" and surface hiring announcements, funding news, and competitive intelligence in real time. Exa is queried *first* in the Discover flow; Apollo provides contacts; HubSpot provides relationship status AND acts as a contact source.

---

## Decisions Log (Finalized)

All architecture and UX decisions resolved during the Jan 30, 2026 planning session:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Standalone vs module | **Standalone app** | Clean separation from dashboard, independent deploy |
| Database | **Supabase (new project) + Vercel KV for caching** | Supabase for exclusions, search history, presets, config. KV for API response caching. |
| Auth | **Password gate + name dropdown** | Shared password, then "Who are you?" dropdown stores name cookie. Lightweight identity for audit trails. |
| Exa query construction | **Hybrid: auto-construct from filters + free-text Cmd+K** | `buildExaQuery(filters)` for structured users, raw text for power users. Modular — easy to swap query templates. |
| Apollo plan | **$99/account (Professional)** | One shared API key. Cache aggressively (24h). Abstract behind interface for future provider swap. |
| HubSpot scope | **Pull-only for MVP** | Read HubSpot contacts as a data source alongside Apollo. Push to HubSpot deferred to Phase 2. |
| Clearout trigger | **On-demand at export step only** | Verify emails only when user selects contacts for final export. Saves credits. |
| Results per search | **25 companies + 25 contacts** | Manageable for MVP. Pagination if needed later. |
| Results view | **Both company-first and contact-first** | Company view (default) + Contacts toggle with smart list UX |
| Contact view UX | **Grouped by company with sticky headers, expandable rows** | Company groups mirror Companies tab sort; contacts expand inline with full detail + actions |
| Exa + Apollo results | **Show both paths** | Split results: "Semantic matches (Exa)" + "Structured matches (Apollo)" sections |
| Data merge in dossier | **Unified with source badges** | One merged dossier, every field has tiny source badge (E/A/H) |
| ICP scoring | **In MVP — rule-based heuristic** | Weighted points, configurable via admin page. Not ML. |
| ICP verticals | **Multiple verticals equally** | No single dominant vertical. ICP weights configurable per search via admin. |
| Loading UX | **Skeleton shimmer cards** | Ghost cards shimmer while data loads. Premium feel. |
| Ownership/claiming | **None in v1** | Everyone sees everything. Sort it out on Slack. |
| Saved searches | **Shared (team-wide)** | Anyone saves a filter preset, everyone sees it. Good for playbooks. |
| Exclusion list MVP | **Manual add + CSV upload** | "Mark as excluded" button on cards + CSV upload for batch |
| Copy format | **User picks default in settings** | Configurable per user via name cookie. Options: Name <email>, CSV row, email only. |
| Screen baseline | **1440px (MacBook Pro 14")** | Standard for the team's hardware |
| Cmd+K | **In MVP — core feature** | Free-text Exa search, quick navigation, contact lookup |
| Admin page | **/admin with named-user restriction** | Only Adi + JVS can access config. Others see read-only. |
| Design reference | **Build from spec in brief** | No existing HTML file. Use design system table as source of truth. |
| Staleness UX | **Timestamp + manual refresh button** | "Last refreshed: 3h ago [↻]" in detail pane header |
| Domain | **Vercel preview URL for now** | Pick custom domain at team launch |

---

## Technical Architecture

### Stack

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + TypeScript | Type safety, component model |
| Styling | Tailwind CSS + CSS variables | Design system tokens, rapid iteration |
| State | Zustand or Jotai | Lightweight, no boilerplate |
| Data fetching | TanStack Query | Caching, dedup, background refresh |
| Database | Supabase (new project) | Exclusions, search history, presets, admin config |
| Caching | Vercel KV / Upstash Redis | API response caching (Exa 6h, Apollo 24h, HubSpot 1h, Clearout 30d) |
| Hosting | Vercel (new project) | Serverless functions, independent from dashboard |
| Auth | Password gate + name cookie | Simple for 8-10 users, upgrade path to Supabase Auth in Phase 2 |

### The Two-Panel Layout (1440px baseline)

FilterPanel was removed in the Feb 2026 rehaul. Search bar is the sole discovery entry point.

```
┌────────────────────────────┬──────────────────────┐
│    RESULTS LIST            │   DETAIL PANE        │
│    (flexible)              │   (420px)             │
│                            │                      │
│  [Cmd+K Search Bar]        │  Company header      │
│  [Entity chips]            │  NL ICP reasoning    │
│                            │  Contacts (inline)   │
│  [Companies ●][Contacts○]  │  CRM (FS + HS)      │
│                            │  Outreach sequences  │
│  Company cards w/ inline   │  Peer companies      │
│  contacts (top 3-5)        │  Signals             │
│                            │  Actions             │
└────────────────────────────┴──────────────────────┘
```

**Results toggle:**
- **Companies view** (default): Company cards with inline contact drawers (top 3-5 by seniority). Discovery searches grouped by ICP tier (High/Good/Low Fit). Company-name searches show exact match + CRM Peers + Discovered sections.
- **Contacts view**: Grouped by company with sticky headers, expandable rows. Sorted by seniority.
- **All Contacts toggle**: Flat view of contacts across all companies, checkable for batch outreach.

### Data Flow

```
User applies filters OR types free-text in Cmd+K
  → buildExaQuery(filters) OR raw text → Exa semantic search
  → Apollo structured search (parallel)
  → HubSpot contact pull (parallel — as data source)
  → Exclusion list filter
  → Return split results: Semantic (Exa) + Structured (Apollo), 25 each
User selects company
  → Parallel: Apollo contacts + HubSpot contacts/history + Exa news/signals
  → Merge & dedupe → unified dossier with source badges (E/A/H)
  → Display company dossier with "Last refreshed: Xh ago [↻]"
User selects contacts for export
  → Clearout email verification (on-demand, only at this step)
  → Export in user's preferred format (configurable in settings)
```

### Exa Query Construction (Modular)

```typescript
// lib/exa/queryBuilder.ts — KEEP THIS MODULAR
// Easy to swap templates, add new filter→query mappings

function buildExaQuery(filters: SearchFilters): string {
  // Size descriptor: 1-50 → "small", 51-200 → "small-to-mid", etc.
  // Vertical: direct pass-through
  // Region: map to natural language
  // Signals: append "hiring" / "expanding" / "funding" if checked
  // Template: "{size} {vertical} companies in {region} {signals}"
}

// Cmd+K bypass: pass raw user text directly to Exa
```

### API Routes (Vercel Serverless)

```
/api/search/companies      POST  — Exa + Apollo parallel search, HubSpot contact pull
/api/company/:id           GET   — Full company dossier (merged, source-badged)
/api/company/:id/contacts  GET   — Contacts from Apollo + HubSpot, merged
/api/company/:id/signals   GET   — Exa news/signals
/api/contact/verify        POST  — Clearout email verification (batch, on export)
/api/export/csv            POST  — Generate CSV download
/api/export/clipboard      POST  — Format for clipboard (user's preferred format)
/api/exclusions            GET/POST/DELETE — Exclusion list CRUD + CSV upload
/api/hubspot/contacts      GET   — Pull HubSpot contacts as source
/api/hubspot/status/:domain GET  — Check HubSpot relationship status
/api/admin/config          GET/PUT — ICP weights, scoring formula, system config
/api/presets               GET/POST/DELETE — Shared search presets (team-wide)
/api/settings/user         GET/PUT — Per-user settings (copy format, preferences)
/api/icp/score             POST  — NL ICP scoring (Groq extraction + Gemini batch scoring)
/api/company/:domain/peers GET   — Peer companies (Freshsales + Exa)
/api/user/config           GET/PUT — Per-user outreach config (Freshsales domain, LinkedIn Sales Nav)
/api/outreach/call-log     POST/GET — Call outcome logging
/api/outreach/sequences    GET/POST — Sequence CRUD
/api/outreach/sequences/:id GET/PUT/DELETE — Single sequence ops
/api/outreach/enrollments  GET/POST — Enrollment CRUD (filter by contact/status/dueBy)
/api/outreach/enrollments/:id GET/PUT — Enrollment management (pause/resume/unenroll/advance)
/api/outreach/enrollments/:id/execute POST — Step execution (channel-specific: email draft, call talking points, LinkedIn note)
```

### Conflict Resolution (When Sources Disagree)

| Field | Priority | Why |
|-------|----------|-----|
| Email | Apollo > HubSpot > Web | Apollo's email finding is their core product |
| Phone | Apollo > HubSpot | More current |
| Job title | LinkedIn (via Apollo) > HubSpot | LinkedIn is canonical for professional identity |
| Company info | Apollo > Web | Structured data preferred |
| Relationship history | HubSpot only | Authoritative for our interactions |

### Confidence Scoring

Every data point shows its source badge and confidence:
- **90–100% (Green)**: Verified — Clearout verified, multiple sources agree
- **70–89% (Yellow)**: Likely accurate — single authoritative source
- **50–69% (Orange)**: Uncertain — inferred or stale
- **<50% (Gray)**: Low confidence — use with caution

### Rate Limiting & Caching (Vercel KV)

| Source | Rate Limit | Cache Duration |
|--------|------------|----------------|
| Exa | Free tier initially, paid plan soon | 6 hours |
| Apollo | 100 req/min (shared key, $99/acct) | 24 hours |
| HubSpot | 100 req/10sec | 1 hour |
| Clearout | 1000/day | 30 days |

---

## Entity Model

```
COMPANY: id, name, domain, industry, employee_count, hq_location, description,
         website_url, linkedin_url, sources[], signals[] → SIGNAL,
         contacts[] → CONTACT, hubspot_status, icp_score (0-100),
         last_refreshed_at

CONTACT: id, first_name, last_name, email, email_confidence (0–100), phone,
         job_title, seniority_level, department, linkedin_url,
         last_contacted_date (from HubSpot), sources[], company_id → COMPANY,
         clearout_verified (boolean), clearout_verified_at

SIGNAL:  type (hiring|funding|expansion|news|tech_stack), title, description,
         date, source_url, relevance_score, company_id → COMPANY

EXCLUSION: type (company|domain|contact_email), value, reason, added_by,
           added_at, source (manual|csv_upload)

SEARCH_PRESET: id, name, filters (JSON), created_by, created_at
               (shared team-wide, visible to all)

ADMIN_CONFIG: key, value (JSON), updated_by, updated_at
              (ICP weights, scoring formula, system settings)

USER_SETTINGS: user_name, copy_format_default, preferences (JSON)
```

---

## ICP Scoring (Dual System)

### Rule-Based (Static, Admin-Configurable)
Default weights (configurable via /admin):

| Signal | Default Points | Admin Editable |
|--------|---------------|----------------|
| Vertical match | +30 | Yes |
| Size match (sweet spot range) | +20 | Yes |
| Region match | +10 | Yes |
| Has buying signals (hiring, funding, expansion) | +20 | Yes |
| Has negative signals (layoffs, competitor user) | -30 | Yes |
| Exa relevance score > 0.8 | +10 | Yes |
| HubSpot: already a lead/opportunity | +15 | Yes |
| HubSpot: already a customer | -50 | Yes |

### NL ICP (Per-Search, LLM-Powered)
For discovery searches only (not company-name lookups):
1. **Criteria extraction** (Groq `llama-3.1-8b-instant`, ~200ms): Parse query → `NLICPCriteria` (verticals, regions, size range, buying/negative signals, qualitative factors)
2. **Batch scoring** (Gemini `gemini-2.0-flash`, ~500ms/batch of 5): Hybrid rule-based + LLM qualitative scoring → 0-100 score + 1-2 sentence reasoning per company
3. Results grouped by ICP tier: High Fit (≥70) / Good Fit (40-69) / Low Fit (<40)
4. Admin can configure "always apply" rules (e.g., "Penalize existing customers by -40")

**Admin page at /admin** (restricted to Adi + JVS):
- Edit ICP weight formula + NL ICP overrides
- Configure vertical match lists
- Set size "sweet spot" ranges
- Toggle signal types on/off
- Toggle outreach suggestion rules on/off
- View and edit exclusion list
- All other configurable parameters

---

## Design System — The Non-Negotiables

Built from spec (no external HTML reference file).

| Element | Value |
|---------|-------|
| Mode | Dark mode only |
| Base colors | Obsidian scale (#06060a → #f0f0f5) |
| Primary accent | Ember (#d4a012) — warm amber-gold |
| Secondary accent | Arctic (#22d3ee) — cool cyan |
| Display font | Instrument Serif (headers) |
| Body font | Plus Jakarta Sans |
| Mono font | Geist Mono (data, technical info) |
| Border radius | 12–16px cards, 8px inputs |
| Transitions | 180ms ease-out, opacity + transform |
| Glass effect | rgba(20, 20, 28, 0.7) + backdrop-filter: blur(20px) |
| Loading states | Skeleton shimmer cards (ghost cards that shimmer) |
| Source badges | Tiny inline badges: E (Exa), A (Apollo), H (HubSpot) |
| Staleness indicator | "Last refreshed: Xh ago" + [↻] refresh button |

### Anti-Patterns — If You See These, Delete Them

1. **No single-color tinge** — don't wash everything in one hue
2. **No left-border-only indicators** — borders must be intentional and complete
3. **No 4-icon feature grids** — hallmark of AI slop
4. **No Inter/Roboto** — use the specified typography
5. **No bouncy animations** — smooth and cinematic only
6. **No purple gradients** — we're not generic SaaS
7. **No partial table borders** — full borders or none
8. **No decorative icons** — every icon must serve a functional purpose. If it doesn't help the user understand or act, delete it. Icons are UI, not decoration.

---

## Keyboard Shortcuts (Build From Day One)

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Command palette — free-text Exa search + quick nav + contact lookup |
| `↑/↓` | Navigate results |
| `Enter` | Select company |
| `Space` | Toggle checkbox |
| `Cmd+A` | Select all visible |
| `Cmd+Shift+A` | Deselect all |
| `Cmd+E` | Export selected |
| `Cmd+C` | Copy current contact's email |
| `Escape` | Close modal / clear selection |
| `/` | Focus filter search |

---

## MVP Scope (Phase 1)

**In scope:**
- Standalone Next.js app on Vercel (new project)
- Supabase (new project) + Vercel KV
- Three-panel layout (filter | list | detail) at 1440px baseline
- Company view + Contacts view toggle
- Exa integration (semantic search + signals, free tier → paid soon)
- Apollo integration (company search + contacts, $99 shared key)
- HubSpot integration (pull-only: contacts as source + relationship status)
- Clearout email verification (on-demand at export step only)
- Split results: Semantic (Exa) + Structured (Apollo), 25 each
- Unified dossier with source badges (E/A/H) + staleness indicator
- ICP scoring (rule-based heuristic, admin-configurable weights)
- Exclusion list (manual "Mark as excluded" button + CSV upload)
- Contact cards with email + confidence badges
- Export to clipboard (user-configurable default format) + CSV
- Cmd+K command palette (free-text Exa search)
- Keyboard navigation
- Password gate + name dropdown auth
- Shared search presets (team-wide)
- Admin page (/admin, restricted to Adi + JVS)
- Skeleton shimmer loading states
- Cinematic dark UI per design spec

**Out of scope (future):**
- Push to HubSpot (create/update contacts)
- Research tool detection (complex technographics)
- Analytics dashboard
- Team activity feed
- Ownership / prospect claiming
- Supabase Auth (upgrade from password gate)
- Mobile / responsive below 1440px

---

## Auth Flow (v1)

```
User visits app
  → Password gate (single shared password)
  → "Who are you?" dropdown (8-10 names)
  → Set cookies: auth_token + user_name
  → Redirect to main app
  → user_name used for: audit trails, export logs, settings, exclusion "added_by"
```

---

## Success Criteria

- 50 qualified prospects/week (up from 20)
- <30 min to qualified list (down from 2+ hours)
- <5% email bounce rate
- >20 exports/week
- Sales team says "The UI is better than Apollo"
- Budget approved for Phase 2

### Red Flags (We Failed If)

- Tool is slower than just using Apollo directly
- Constant API errors or timeouts
- Users still open Apollo/ZoomInfo anyway
- Export is confusing or limited
- "It looks like every other AI tool"

---

## Anti-Requirements (What This Tool Does NOT Do)

1. Does not replace Apollo — we aggregate, not duplicate
2. Does not send emails — drafts outreach copy, user sends manually
3. Does not auto-send LinkedIn messages — copy-paste only (no API)
4. Does not have a mobile app — desktop power users
5. Does not gamify — no leaderboards, no points

---

## Lessons & Pitfalls From the myRA Dashboard

This project lives alongside the myRA Status Dashboard (the trial management tool). Key lessons carried over:

1. **Don't use useState/useEffect for data fetching** — use TanStack Query (React Query). We learned this the hard way on the dashboard.
2. **Batch API operations** — 50-item batch size is optimal. Don't fire 200 individual requests.
3. **Zod for all validation** — use `message:` syntax for custom errors.
4. **Never expose service keys client-side** — server-side only for sensitive API keys (Apollo, HubSpot, etc.).
5. **Build the design system first** — colors, typography, spacing tokens before any feature work. The dashboard suffered from inconsistent styling when we skipped this.
6. **Mock data before wiring APIs** — use hardcoded JSON to nail the UI, then swap in real APIs. Much faster iteration.
7. **Keyboard shortcuts from day one** — bolting them on later is painful.
8. **Exa first, always** — when implementing data sources, Exa is the primary discovery engine. It's the trump card that makes Navigator smarter than Apollo's native UI.
9. **Abstract data providers** — Apollo's API terms can change. Build behind interfaces so we can swap providers without rewriting the UI.
10. **Show API credit usage** — the dashboard didn't track this and it caused surprises. Show "X credits remaining" somewhere visible.

---

## Admin Page (/admin — Restricted Access)

Accessible only to: **Adi, JVS**

Configurable settings:
- ICP scoring weights (vertical, size, region, signals — all editable)
- Vertical match lists (which verticals count as "match")
- Size sweet-spot range
- Signal type toggles
- Exclusion list management (view, add, remove, CSV upload)
- Search preset management
- System-level settings (cache durations, API rate limit alerts)
- Any future configurable parameter

**Principle: Every heuristic or arbitrary decision gets an admin toggle.** Don't hardcode business logic that might need tuning.

---

## Environment Variables

```
# Exa (primary discovery engine — free tier initially, paid plan soon)
EXA_API_KEY=xxx

# Apollo (contacts + firmographics — $99/acct, shared key)
APOLLO_API_KEY=xxx

# HubSpot (relationship status + contact source — pull only in v1)
HUBSPOT_ACCESS_TOKEN=xxx

# Clearout (email verification — on-demand at export only)
CLEAROUT_API_KEY=xxx

# Supabase (new project — exclusions, presets, config, search history)
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Vercel KV (API response caching)
KV_REST_API_URL=xxx
KV_REST_API_TOKEN=xxx

# Auth
SHARED_AUTH_PASSWORD=xxx
ADMIN_USERS=adi,jvs

# Groq (NL ICP criteria extraction — llama-3.1-8b-instant)
GROQ_API_KEY=xxx

# Gemini (NL ICP batch scoring — gemini-2.0-flash)
GEMINI_API_KEY=xxx

# Freshsales (CRM contacts, deals, activities)
FRESHSALES_API_KEY=xxx
FRESHSALES_DOMAIN=xxx
```

---

## User Personas

| Name | Role | Style |
|------|------|-------|
| Adi | Sales Director | Strategic targeting, reviews team lists, approves campaigns. Admin access. |
| Satish Boini | Account Manager | Heavy prospecting, fast filtering by region/vertical |
| Sudeshana Jain | Account Manager | Methodical researcher, values data quality over speed |
| Kirandeep Kaur | Account Manager | Power user, will use Cmd+K and keyboard shortcuts |
| Nikita Manmode | Account Manager | Prefers visual interfaces, appreciates good UX |

---

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

---

## Contacts Tab Decisions (Feb 2026)

| Decision | Choice |
|----------|--------|
| Fetch timing | Lazy — on Contacts tab switch, not on search |
| Loading UX | Progressive — show contacts as each company's contacts arrive |
| Count display | Estimated from search results while loading, actual when done |
| Contact row fields | Name, email (primary), source badges, last contacted (if exists) |
| Company context | Grouped under company headers (sticky) |
| Click on contact row | Expand inline to show full detail + actions |
| Sort/filter controls | Contact-specific: seniority level, has email, data source |
| Company chip in row | Rich popover on hover (200ms delay): name, ICP, size, industry, status |
| Expanded row actions | Copy email, View dossier, Draft email, Mark excluded |
| Export | Batch only — select with checkboxes, Cmd+E exports all selected |
| Contact exclusion | Email-type exclusion via existing API |
| Configurable columns | Inline gear icon on Contacts tab — toggle fields on/off |
| Company group order | Same order as Companies tab (mirrors active sort) |
| Filter/sort persistence | Zustand store (persists across tab switches) |
| Collapse/expand groups | Collapse all / expand all toggle at top of grouped list |
| Keyboard nav | Arrow keys navigate contacts, Space toggles checkbox, Enter expands, Cmd+C copies email |

---

## Current State (Post-Audit, Feb 2026)

- **Enrichment:** All contacts auto-enriched via Apollo (pLimit(5) concurrency cap). Clearout-first fallback for contacts still missing email after Apollo — capped at 10/company.
- **Confidence:** Default 70 when Apollo returns email but null confidence (was incorrectly 0).
- **Cache TTLs:** Enriched contacts 2h, Apollo contacts list 2h, Apollo person 24h (credit-bearing), Clearout 30d. Search pre-warms enriched contacts cache fire-and-forget. Refresh clears both enriched + Apollo contacts caches.
- **Export:** Filters out contacts without email server-side (clipboard + CSV routes). Per-domain extraction logging (one `contact_extractions` row per company domain). Skip count shown in toast.
- **Exclusion:** Supports `email` and `contact_id` types. Contacts without email can be excluded by apolloId. Server-side filtering of contact_id exclusions in contacts route.
- **Contacts tab:** 300ms minimum skeleton display prevents "0 contacts" flash. Re-fetches when filtered companies change (companyDomainKey in effect deps).
- **Export picker:** Fetches contacts on demand (fetchQuery + Zustand write), shows spinner until loaded.
- **Browser notifications:** Native `Notification` API fires when tab is backgrounded (`document.hidden`) and a long-running op completes. Hook: `useBrowserNotifications` (`src/hooks/navigator/useBrowserNotifications.ts`). Wired into 5 locations: search complete/error (SearchBridge), export complete/fail (useExport), verification done (useExport → exportPickedContacts), contacts tab loaded (useContactsTab), dossier refresh (SlideOverPane). Gated by localStorage flag `nav_notifications_enabled` + granted permission. Auto-close 5s, click focuses tab. Toggle in Settings → Notifications; disabled state when browser has blocked.
- **Workflow preferences (Settings page):** Two toggles under Settings → Workflow. (1) Skip email reveal confirm (`nav_skip_reveal_confirm`) — "Find email" reveals immediately, already wired in ContactCard. (2) Auto-export / skip picker (`nav_auto_export`) — Cmd+E in companies view calls `executeExport` directly, bypassing the contact picker modal. Invalid-email warning toast still fires. Both read/write localStorage directly.

---

## Rehaul (Feb 2026) — Implemented Features

### Phase 1: Layout + Inline Contacts
- **2-panel layout**: FilterPanel + all filter components deleted. Search bar is sole discovery entry point.
- **Clearout auto-verify**: Contacts auto-verified on load (useCompanyDossier useEffect). Capped at 50/batch.
- **Inline contacts on company cards**: Top 3-5 contacts by seniority (c_level > vp > director > manager). Low-seniority filtered out (intern/coordinator/assistant).
- **All Contacts toggle**: Flat contact view across all search result companies. Store: `allContactsViewActive`, `selectedContactsForOutreach`.

### Phase 2: NL ICP Scoring
- **Groq extraction** (`llama-3.1-8b-instant`): Parses search query → `NLICPCriteria` (verticals, regions, size range, signals, qualitative factors).
- **Gemini scoring** (`gemini-2.0-flash`): Batches of 5 companies → 0-100 score + reasoning.
- Discovery searches grouped by ICP tier. Company-name searches skip scoring.
- Files: `src/lib/navigator/llm/icpPrompts.ts`, `src/app/api/icp/score/route.ts`.

### Phase 3: Peer Companies
- **Freshsales peers**: `getFreshsalesPeers(industry, excludeDomain)` via `paginatedFilteredSearch` on `industry_type`.
- **Exa peers**: Semantic similarity via existing Exa search.
- Company-name searches show: exact match → CRM Peers → Discovered sections.
- Dossier: `DossierSimilarCompanies.tsx` component. API: `/api/company/[domain]/peers`.

### Phase 4: Multi-Channel Outreach + Sequences
- **Channels**: Email, Call, LinkedIn Connect, LinkedIn InMail, WhatsApp. `OutreachChannel` type updated.
- **Call channel**: Talking points via LLM. Deep-link to Freshsales contact page (`https://{domain}.freshsales.io/contacts/{id}`). `CallOutcomeModal` for logging (connected/voicemail/no_answer/busy/wrong_number).
- **LinkedIn**: Opens profile URL + draft connection note or InMail (copy-paste only, no API). Gated by per-user `hasLinkedinSalesNav` toggle.
- **Sequence builder**: `SequenceBuilder.tsx` — visual vertical timeline, connected nodes, channel color-coding, reorder, inline editing.
- **Enrollment flow**: `SequenceEnrollModal.tsx` — pick existing sequence or create ad-hoc, batch enroll contacts.
- **Progress tracking**: `SequenceTimeline.tsx` — step status (completed/current/pending/skipped), due dates, pause/resume/unenroll.
- **Due steps widget**: `DueStepsWidget.tsx` on home screen (pre-search empty state). Shows today's due steps grouped by contact.
- **Per-user config**: Settings → Outreach. Freshsales domain input + LinkedIn Sales Nav checkbox. Stored in `user_config` Supabase table.
- **Outreach modal redesign**: Tab bar "One-Shot" | "Sequence". One-shot = existing draft flow + call channel. Sequence = pick/create sequence + enroll.
- **Suggestion engine**: `warm_contact_call` rule added — warm CRM contact with phone → suggest call.
- **Store additions**: `activeSequences`, `activeEnrollments`, `userConfig`, `selectedContactsForOutreach`.

### Phase 5: Freshsales Prominence + Export
- **Freshsales section elevated** in dossier (right after overview, before signals).
- **"In Freshsales" column** added to both CSV and clipboard exports.
- Excel primary, CSV secondary.

### Phase 6: Credit Awareness
- `CreditUsageIndicator` always visible in ResultsList top bar.
- Shows Apollo (X/4K) + Clearout (X/50K) counts.
- Apollo replenish date tooltip on hover.

### Supabase Tables (added in rehaul)
- `outreach_drafts` — draft logging (fire-and-forget)
- `user_config` — per-user settings (PK: user_name)
- `call_logs` — call outcome tracking
- `outreach_sequences` — sequence definitions (JSONB steps)
- `outreach_enrollments` — contact-sequence enrollments
- `outreach_step_logs` — step execution records
- Migration: `supabase/migrations/20260209_outreach_sequences.sql`

---

## Pending Items (Cross-Project)

- Roadmap feature streamlining: master roadmap entries can't be made separately — wrong approach. Will address after bulk import consolidation.

---

## How to Think About Building This

Start with the design system. Get colors, typography, and spacing right. Then build the shell — three-panel layout with the obsidian dark aesthetic at 1440px. Mock all data with hardcoded JSON (25 companies + 25 contacts). Wire Exa first (it's the discovery engine), then Apollo for contacts, then HubSpot as contact source + status check, then Clearout at the export step. Build the admin page early so you can tune ICP weights without code changes. Test with Satish and Adi weekly.

The goal is a tool that makes the sales team faster, not a tool that shows off technical sophistication. Ship something useful, then iterate.
