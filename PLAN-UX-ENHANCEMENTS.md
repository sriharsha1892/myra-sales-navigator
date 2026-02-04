# UX Enhancement Plan — myRA Sales Navigator

> Execute each section as a separate task. Sections are ordered by dependency — build top-to-bottom.
> Each section lists exact files to create/modify, types to add, and implementation notes.

---

## Section 1: Multi-Channel Outreach Drafts (OutreachDraftModal)

**Goal:** Replace the email-only `EmailDraftModal` with a channel-aware `OutreachDraftModal` that generates drafts for Email, LinkedIn Connection Request, LinkedIn InMail, and WhatsApp follow-up. No Twitter/X DM.

### 1A. New Types

**File:** `src/lib/navigator/types.ts`

Add after the `EmailDraftResponse` interface (~line 609):

```typescript
export type OutreachChannel = "email" | "linkedin_connect" | "linkedin_inmail" | "whatsapp";

export interface ChannelConstraints {
  maxChars: number | null;       // null = no hard limit (email)
  maxWords: number | null;
  hasSubject: boolean;
  outputFields: string[];        // ["subject", "body"] or ["message"]
  platformGuidance: string;      // injected into LLM prompt
}

export interface OutreachDraftRequest extends EmailDraftRequest {
  channel: OutreachChannel;
  writingRules?: string;         // user-supplied writing guidelines
  contextPlaceholders?: Record<string, string>; // manual overrides like {{customHook}}
}

export interface OutreachDraftResponse {
  channel: OutreachChannel;
  subject?: string;              // only for email + linkedin_inmail
  message: string;               // always present
}
```

### 1B. Channel Constraints Config

**File:** `src/lib/navigator/outreach/channelConfig.ts` (NEW)

```typescript
import type { OutreachChannel, ChannelConstraints } from "../types";

export const CHANNEL_CONSTRAINTS: Record<OutreachChannel, ChannelConstraints> = {
  email: {
    maxChars: null,
    maxWords: 150,
    hasSubject: true,
    outputFields: ["subject", "body"],
    platformGuidance: "Professional email. Lead with value. No generic openers.",
  },
  linkedin_connect: {
    maxChars: 300,
    maxWords: null,
    hasSubject: false,
    outputFields: ["message"],
    platformGuidance: "LinkedIn connection request. Max 300 characters. Find mutual ground or shared context. Do NOT sell. Be human. One sentence about why you want to connect.",
  },
  linkedin_inmail: {
    maxChars: null,
    maxWords: 200,
    hasSubject: true,
    outputFields: ["subject", "message"],
    platformGuidance: "LinkedIn InMail. Consultative tone. Reference something specific about their profile or company. Shorter than email. No attachments or links in first message.",
  },
  whatsapp: {
    maxChars: 300,
    maxWords: null,
    hasSubject: false,
    outputFields: ["message"],
    platformGuidance: "WhatsApp follow-up message. Assume prior contact exists. Conversational, mobile-first. No formal salutations. Short paragraphs. Emoji OK but sparingly.",
  },
};

// Admin-configurable channel labels + enabled state
export const CHANNEL_OPTIONS: { value: OutreachChannel; label: string; icon: string }[] = [
  { value: "email", label: "Email", icon: "mail" },
  { value: "linkedin_connect", label: "LinkedIn Connect", icon: "linkedin" },
  { value: "linkedin_inmail", label: "LinkedIn InMail", icon: "linkedin" },
  { value: "whatsapp", label: "WhatsApp", icon: "message-circle" },
];
```

### 1C. Outreach Prompt Builder

**File:** `src/lib/navigator/llm/outreachPrompts.ts` (NEW)

Build this as a wrapper around the existing `buildEmailPrompt` in `emailPrompts.ts`:

- Import `buildEmailPrompt` for the email channel (reuse as-is)
- For other channels, build a new prompt using:
  - `CHANNEL_CONSTRAINTS[channel].platformGuidance` as the core instruction
  - Same contact/company/signal context blocks from `emailPrompts.ts` (extract into shared helper)
  - `request.writingRules` appended as "Additional writing rules from the user:\n{rules}"
  - `request.contextPlaceholders` substituted into the prompt via `{{key}}` replacement
  - Character/word limit enforced in prompt: "You MUST stay under {maxChars} characters" or "Keep under {maxWords} words"
  - Output format: `{ "message": "..." }` for channels without subject, `{ "subject": "...", "message": "..." }` for those with
- Admin-configurable per-channel instructions stored in `adminConfig.outreachChannelInstructions` (new field — see 1F)

**Key function signatures:**
```typescript
export function buildOutreachPrompt(
  request: OutreachDraftRequest,
  config?: EmailPromptsConfig,
  channelOverrides?: Partial<Record<OutreachChannel, string>>
): string;

// Extracted from emailPrompts.ts — shared context builder
export function buildProspectContext(request: OutreachDraftRequest): string;
```

### 1D. API Route

**File:** `src/app/api/outreach/draft/route.ts` (NEW)

- Mirrors `src/app/api/email/draft/route.ts` structure
- Accepts `OutreachDraftRequest` body
- Calls `buildOutreachPrompt` instead of `buildEmailPrompt`
- Same Gemini → Groq fallback
- Returns `OutreachDraftResponse`
- Logs usage to a new `outreach_drafts` table (see 1G)

Keep the old `/api/email/draft` route working (backwards compat). The new modal calls `/api/outreach/draft`.

### 1E. OutreachDraftModal Component

**File:** `src/components/navigator/outreach/OutreachDraftModal.tsx` (NEW)

Replace `EmailDraftModal` usage everywhere. Structure:

```
OutreachDraftModal
├── Header: "Draft Outreach — {contact.firstName} at {company.name}"
├── Channel Selector: horizontal pill toggle (Email | LinkedIn Connect | InMail | WhatsApp)
│   - WhatsApp disabled if no prior CRM contact (hubspotStatus === "none" && freshsalesStatus === "none")
│   - Tooltip on disabled: "WhatsApp requires prior contact"
├── Template + Tone selectors (same as current, but filtered per channel)
│   - LinkedIn Connect: tone locked to "casual" or "direct" only
│   - WhatsApp: tone locked to "casual"
├── Writing Rules textarea (collapsible, optional)
│   - Label: "Additional context or writing rules"
│   - Placeholder: "e.g., Mention our recent case study with Unilever..."
│   - Persists per-session in Zustand (so reps don't re-type)
├── Context Placeholders (collapsible, optional)
│   - Key-value pairs: {{customHook}} → "your recent podcast appearance"
│   - Auto-detected from template: scan for {{...}} patterns not in standard variables
├── Generate button
├── Draft display area
│   - Subject input (hidden for channels without subject)
│   - Message textarea
│   - Character counter for LinkedIn Connect + WhatsApp (turns red near limit)
├── Footer: Regenerate | Cancel | Copy to Clipboard
```

**Integration points:**
- `ContactCard.tsx` line 576: change `handleDraftEmail` → `handleDraftOutreach`, open `OutreachDraftModal` instead of `EmailDraftModal`
- `DossierContacts.tsx`: same change where "Draft email" action exists
- Keep `EmailDraftModal.tsx` file but mark deprecated — import redirect to `OutreachDraftModal`

### 1F. Admin Config Extension

**File:** `src/lib/navigator/types.ts` — extend `AdminConfig` interface:

```typescript
// Add to AdminConfig:
outreachChannelConfig: {
  enabledChannels: OutreachChannel[];
  channelInstructions: Partial<Record<OutreachChannel, string>>;  // admin overrides per channel
  defaultChannel: OutreachChannel;
  writingRulesDefault: string;   // team-wide default writing rules
};
```

**File:** `src/lib/navigator/mock-data.ts` — add defaults:
```typescript
outreachChannelConfig: {
  enabledChannels: ["email", "linkedin_connect", "linkedin_inmail", "whatsapp"],
  channelInstructions: {},
  defaultChannel: "email",
  writingRulesDefault: "",
},
```

**Admin UI:** Add a new section `OutreachChannelsSection.tsx` under `src/components/navigator/admin/`:
- Toggle channels on/off
- Edit per-channel instructions (textarea per channel)
- Set default channel
- Set team-wide writing rules default

### 1G. Database: Outreach Tracking

**Supabase table:** `outreach_drafts`
```sql
CREATE TABLE outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id text NOT NULL,
  contact_email text,
  company_domain text NOT NULL,
  channel text NOT NULL,
  template text,
  tone text NOT NULL,
  generated_by text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  subject text,
  message text NOT NULL,
  copied boolean DEFAULT false,
  writing_rules text
);
CREATE INDEX idx_outreach_drafts_contact ON outreach_drafts(contact_id);
CREATE INDEX idx_outreach_drafts_domain ON outreach_drafts(company_domain);
```

This enables: "What outreach has already been drafted for this contact?" — prevents duplicate cold intros.

---

## Section 2: Smart Template Auto-Suggestion

**Goal:** When the OutreachDraftModal opens, auto-suggest the best template + channel based on dossier context. Fully rule-based, admin-configurable.

### 2A. Suggestion Engine

**File:** `src/lib/navigator/outreach/suggestTemplate.ts` (NEW)

```typescript
import type {
  OutreachChannel,
  EmailTemplate,
  CompanyEnriched,
  Contact,
} from "../types";

export interface TemplateSuggestion {
  channel: OutreachChannel;
  template: EmailTemplate | string;  // built-in or custom template ID
  tone: EmailTone;
  reason: string;                     // shown in UI: "No CRM record — cold intro recommended"
}

export interface SuggestionRule {
  id: string;
  name: string;
  priority: number;                   // lower = higher priority
  conditions: SuggestionCondition[];  // ALL must match (AND)
  suggestion: Omit<TemplateSuggestion, "reason">;
  reason: string;
  enabled: boolean;
}

export interface SuggestionCondition {
  field: "hubspotStatus" | "freshsalesStatus" | "icpScore" | "hasSignals" | "daysSinceExport" | "daysSinceLastContact" | "contactSeniority" | "hasExistingDraft";
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "notIn";
  value: string | number | string[] | boolean;
}

export function suggestTemplate(
  company: CompanyEnriched,
  contact: Contact,
  rules: SuggestionRule[],
  existingDrafts?: { channel: OutreachChannel; template: string }[]
): TemplateSuggestion | null;
```

**Default rules** (admin can edit/reorder/disable via `/admin`):

| Priority | Conditions | Suggestion | Reason |
|----------|-----------|------------|--------|
| 1 | hubspot=none AND freshsales=none AND no existing draft | LinkedIn Connect + casual | "Net-new prospect — connect first" |
| 2 | hubspot=none AND freshsales=none AND has linkedin_connect draft | Email intro + direct | "Already connected — send intro email" |
| 3 | hubspot=open AND daysSinceLastContact > 30 | Email re-engagement + formal | "Open deal gone cold — re-engage" |
| 4 | freshsales=won OR freshsales=customer | Email follow-up + casual | "Existing customer — expansion play" |
| 5 | icpScore >= 80 AND hasSignals=true | Email intro + direct | "Strong ICP fit with signals — go direct" |
| 6 | contactSeniority in [c_level, vp] | LinkedIn InMail + formal | "Senior contact — InMail for visibility" |
| 7 | fallback | Email intro + formal | "Default outreach" |

### 2B. Admin Config for Rules

**Extend `AdminConfig`:**
```typescript
outreachSuggestionRules: SuggestionRule[];
```

**Admin UI:** Add `OutreachSuggestionsSection.tsx`:
- List rules, drag to reorder priority
- Toggle enabled/disabled per rule
- Edit conditions + suggestion per rule
- "Add custom rule" button
- Preview: "Given company X and contact Y, the suggestion would be Z"

### 2C. UI Integration

In `OutreachDraftModal`, on mount:
1. Call `suggestTemplate(company, contact, rules, existingDrafts)`
2. If suggestion returned → pre-select channel + template + tone
3. Show suggestion pill: "Suggested: LinkedIn Connect — Net-new prospect" with dismiss (×)
4. User can override any selection

To check existing drafts: query `outreach_drafts` table for this contact_id (lightweight — cache in Zustand per session).

---

## Section 3: Recommended Next Action in Dossier

**Goal:** Show a contextual "Recommended action" bar in the dossier that tells the rep what to do next. ICP-informed, admin-configurable rules.

### 3A. Action Recommendation Engine

**File:** `src/lib/navigator/outreach/recommendAction.ts` (NEW)

```typescript
export interface RecommendedAction {
  action: "draft_outreach" | "export_contacts" | "add_note" | "mark_researching" | "re_engage" | "skip";
  label: string;           // "Draft intro to Sarah Chen (VP Sales)"
  description: string;     // "Strong ICP fit (85) with hiring signals. No prior outreach."
  contactId?: string;      // if action targets a specific contact
  channel?: OutreachChannel;
  priority: "high" | "medium" | "low";
}

export interface ActionRule {
  id: string;
  name: string;
  priority: number;
  conditions: SuggestionCondition[];  // reuse from Section 2
  action: Omit<RecommendedAction, "label" | "description">;
  labelTemplate: string;    // "Draft intro to {{topContact}}"
  descriptionTemplate: string;
  enabled: boolean;
}

export function recommendAction(
  company: CompanyEnriched,
  contacts: Contact[],
  rules: ActionRule[],
  exportHistory?: { exportedAt: string; contactCount: number }[]
): RecommendedAction | null;
```

**Default rules:**

| Priority | Conditions | Action | Label Template |
|----------|-----------|--------|----------------|
| 1 | icpScore >= 75 AND hasSignals AND no exports AND status=new | draft_outreach (high) | "Reach out to {{topContact}} — {{topSignal}}" |
| 2 | icpScore >= 60 AND status=researching AND daysSinceStatusChange > 5 | draft_outreach (medium) | "Been researching {{companyName}} for {{days}} days — time to reach out" |
| 3 | hasExports AND daysSinceExport > 7 AND status=contacted | re_engage (medium) | "Exported {{exportCount}} contacts {{days}}d ago — follow up" |
| 4 | freshsales=customer AND hasSignals(expansion) | draft_outreach (high) | "Expansion opportunity at {{companyName}} — {{signalTitle}}" |
| 5 | icpScore < 40 | skip (low) | "Low ICP fit ({{icpScore}}) — consider skipping" |
| 6 | no contacts loaded | export_contacts (medium) | "Load contacts to start prospecting" |

### 3B. Admin Config

**Extend `AdminConfig`:**
```typescript
actionRecommendationRules: ActionRule[];
actionRecommendationEnabled: boolean;  // global toggle
```

**Admin UI:** `ActionRecommendationsSection.tsx` — same pattern as outreach suggestions (drag to reorder, toggle, edit).

### 3C. Dossier UI

**File:** `src/components/navigator/dossier/DossierHeader.tsx`

Add below the company description block (~after line 37), before the Freshsales status:

```
RecommendedActionBar (NEW component)
├── Icon (contextual: outreach icon, export icon, note icon)
├── Label: "Reach out to Sarah Chen (VP Sales)"
├── Description: "ICP 85, hiring signal from 3 days ago"
├── Action button: "Draft Outreach" / "Export" / "Add Note"
│   - Clicking "Draft Outreach" opens OutreachDraftModal pre-filled with the suggested contact
│   - Clicking "Export" triggers export flow
├── Dismiss (×): hides for this session
```

Styling: subtle amber/gold highlight bar, not intrusive. Matches the existing Freshsales status banner pattern.

**Data dependency:** Needs contacts loaded. If contacts haven't been fetched yet for this company, show nothing (don't trigger a fetch just for the recommendation). Once contacts arrive (lazy load), recommendation appears.

---

## Section 4: NewsAPI Integration (Configurable Signal Source)

**Goal:** Add NewsAPI as an additional signal source alongside Exa's news search. Fully admin-configurable (enable/disable, API key, categories, max results).

### 4A. Provider

**File:** `src/lib/navigator/providers/newsapi.ts` (NEW)

```typescript
import type { Signal } from "../types";
import { getCached, setCached } from "@/lib/cache";

export interface NewsApiConfig {
  enabled: boolean;
  apiKey: string;          // from env or admin config
  maxResults: number;      // default 5
  categories: string[];    // ["business", "technology"]
  language: string;        // "en"
  cacheTtlMinutes: number; // default 360 (6h, same as Exa)
}

export function isNewsApiAvailable(): boolean;

// Search by company name or domain
export async function fetchNewsApiSignals(
  companyName: string,
  domain: string,
  config?: Partial<NewsApiConfig>
): Promise<Signal[]>;
```

**Implementation notes:**
- Use NewsAPI `/v2/everything` endpoint with `q="{companyName}" OR site:{domain}`
- Sort by `publishedAt` desc
- Map articles → Signal objects with `source: "newsapi"` (add to `ResultSource` union type)
- Cache key: `newsapi:signals:{domain}`, TTL from config
- Rate limit: NewsAPI free = 100 req/day, paid = 1000 req/day. Track usage.
- Parse each article into Signal: `type` inferred from keywords (hiring/funding/expansion/news), `title` from article title, `description` from article description, `date` from publishedAt, `sourceUrl` from url

### 4B. Signal Type Inference

**File:** `src/lib/navigator/providers/newsapi.ts` (inside same file)

```typescript
function inferSignalType(title: string, description: string): SignalType {
  const text = `${title} ${description}`.toLowerCase();
  if (/hiring|recruit|job opening|talent/.test(text)) return "hiring";
  if (/funding|raised|series [a-f]|investment|investor/.test(text)) return "funding";
  if (/expand|new market|acquisition|merger|partnership|launch/.test(text)) return "expansion";
  return "news";
}
```

### 4C. Integration into Search + Dossier

**File:** `src/app/api/search/companies/route.ts`

In the parallel fetch block where Exa signals are fetched, add NewsAPI as another parallel source:
```
// Existing: Exa search + Apollo search (parallel)
// Add: if newsApiEnabled, fetch newsapi signals for top 10 company names (parallel, fire-and-forget pre-warm)
```

**File:** `src/app/api/company/[domain]/signals/route.ts`

Merge NewsAPI signals alongside Exa signals:
```
// Existing: Exa news signals
// Add: NewsAPI signals (if enabled)
// Dedupe by title similarity (fuzzy match — same story from different sources)
// Source badge: "N" for NewsAPI (add to SourceBadge component)
```

### 4D. Admin Config

**Extend `AdminConfig`:**
```typescript
newsApiConfig: {
  enabled: boolean;
  maxResults: number;
  categories: string[];
  language: string;
  cacheTtlMinutes: number;
  signalTypeKeywords: Record<SignalType, string[]>;  // admin can edit keyword→type mapping
};
```

**Admin UI:** `NewsApiSection.tsx`:
- Enable/disable toggle
- API key input (stored encrypted like other keys, via existing `ApiKeyEntry` pattern)
- Max results slider (1-20)
- Category multi-select
- Cache TTL input
- Signal keyword mapping editor: "Which words indicate 'hiring'?" — editable list per type
- Test button: "Fetch signals for [domain]" → shows preview

**Environment variable:** `NEWSAPI_API_KEY` (add to `.env.example` and env var docs)

### 4E. Source Badge

**File:** `src/components/navigator/badges/SourceBadge.tsx`

Add `newsapi` to the badge map:
```typescript
// Existing: E (Exa), A (Apollo), H (HubSpot), F (Freshsales), C (Clearout)
// Add: N (NewsAPI) — color: #4A90D9 (news blue)
```

**File:** `src/lib/navigator/types.ts` line 1:
```typescript
export type ResultSource = "exa" | "apollo" | "hubspot" | "clearout" | "mordor" | "freshsales" | "newsapi";
```

### 4F. Signal Deduplication

When merging Exa + NewsAPI signals, dedupe:
- Normalize titles: lowercase, strip punctuation
- If two signals share >60% words in title → keep the one with more detail (longer description)
- Tag merged signals with both sources

**File:** `src/lib/navigator/providers/signalMerge.ts` (NEW)
```typescript
export function mergeAndDedupeSignals(
  exaSignals: Signal[],
  newsApiSignals: Signal[]
): Signal[];
```

---

## Section 5: Exported Contacts View + Follow-Up Nudges

**Goal:** Surface the `contact_extractions` data that's already being logged. Give reps visibility into what they've exported and when to follow up.

### 5A. Exported Contacts Panel

**File:** `src/components/navigator/exports/ExportedContactsPanel.tsx` (NEW)

Accessible via:
- New tab in the main results area: `[Companies] [Contacts] [Exported]`
- Or: section in the settings/profile page

**Layout:**
```
ExportedContactsPanel
├── Header: "Recent Exports" + date range filter (last 7d / 30d / all)
├── Summary: "42 contacts exported this week across 12 companies"
├── Grouped by company (same pattern as Contacts tab)
│   ├── Company header: name + domain + export date + exported by
│   └── Contact rows: name, title, email, export destination (CSV/clipboard)
├── Follow-up column: days since export + status pill
│   - < 3 days: "Fresh" (green)
│   - 3-7 days: "Follow up" (amber)
│   - > 7 days: "Stale" (red)
└── Action: "Re-export" / "Draft follow-up" (opens OutreachDraftModal with re_engagement template)
```

### 5B. API Route

**File:** `src/app/api/contact/export-history/route.ts` (already exists — extend)

Add query params:
- `?user=satish` — filter by who exported
- `?since=2026-01-28` — date filter
- `?domain=acme.com` — filter by company
- Response: grouped by company, sorted by export date desc

### 5C. Follow-Up Nudges

**File:** `src/components/navigator/shared/FollowUpNudges.tsx` (NEW)

Show on the home page (below search bar, above results):
```
┌─────────────────────────────────────────────────────────┐
│ Follow-up needed:                                        │
│ • Acme Inc — 8 contacts exported 6 days ago (Satish)    │
│ • GlobalCorp — 3 contacts exported 9 days ago (Sudeshana)│
│ [View all exports →]                                     │
└─────────────────────────────────────────────────────────┘
```

**Logic:**
- Query `contact_extractions` where `exported_at` between 3 and 14 days ago
- Group by company_domain
- Filter by current user (from name cookie) — or show all for admins
- Only show if > 0 follow-ups needed
- Dismissable per-session

### 5D. Store Extension

**File:** `src/lib/navigator/store.ts`

```typescript
// Add to state:
exportHistory: ContactExtraction[];
followUpNudges: { domain: string; companyName: string; contactCount: number; exportedAt: string; exportedBy: string }[];
followUpNudgesDismissed: boolean;

// Add actions:
fetchExportHistory: (filters?: { user?: string; since?: string }) => void;
fetchFollowUpNudges: () => void;
dismissFollowUpNudges: () => void;
```

---

## Section 6: Session Starter — "Who to Target Today"

**Goal:** When a rep opens the app with no active search, show contextual suggestions based on their history and pipeline state.

### 6A. Session Insights API

**File:** `src/app/api/session/insights/route.ts` (NEW)

Returns:
```typescript
interface SessionInsights {
  staleResearching: { domain: string; name: string; daysSinceChange: number }[];  // status=researching for >5 days
  unexportedHighIcp: { domain: string; name: string; icpScore: number }[];        // viewed but never exported, ICP > 70
  recentVerticals: string[];                                                        // verticals from last 5 searches
  suggestedVertical: string | null;                                                  // least-explored vertical this week
  followUpCount: number;                                                             // exports needing follow-up
}
```

**Data sources** (all already in Supabase):
- `companies` table: status + status_changed_at + extraction_count
- `session_views`: recent views by user
- `search_history`: recent search filters
- `contact_extractions`: export dates

### 6B. Home Page Integration

**File:** `src/app/(navigator)/page.tsx`

When `searchResults === null` (no active search), show:

```
SessionStarterCard (NEW component)
├── "Good morning, Satish" (from name cookie)
├── Sections (only show non-empty):
│   ├── "Stale pipeline" — 3 companies stuck in Researching > 5 days [View →]
│   ├── "Unexported prospects" — 5 high-ICP companies viewed but not exported [View →]
│   ├── "Follow-ups due" — 8 contacts exported > 5 days ago [View →]
│   └── "Try exploring" — "{suggestedVertical}" (link pre-fills search)
└── Dismissed on any search action
```

**File:** `src/components/navigator/home/SessionStarterCard.tsx` (NEW)

Fetch on mount via TanStack Query (`queryKey: ["session-insights", userName]`, staleTime 5min).

---

## Execution Order

```
Section 1 (Multi-Channel Outreach)     ← Foundation — everything else builds on this
  ├── 1A-1B: Types + channel config     (30 min)
  ├── 1C: Prompt builder                (1-2 hours)
  ├── 1D: API route                     (45 min)
  ├── 1E: OutreachDraftModal            (2-3 hours)
  ├── 1F: Admin config                  (1 hour)
  └── 1G: DB table + tracking           (30 min)

Section 2 (Smart Suggestions)          ← Depends on Section 1
  ├── 2A: Suggestion engine             (1-2 hours)
  ├── 2B: Admin config + UI             (1-2 hours)
  └── 2C: Modal integration             (30 min)

Section 3 (Recommended Actions)        ← Depends on Section 2 (reuses rule engine)
  ├── 3A: Action engine                 (1 hour)
  ├── 3B: Admin config                  (1 hour)
  └── 3C: Dossier UI                    (1 hour)

Section 4 (NewsAPI)                    ← Independent — can be built in parallel
  ├── 4A-4B: Provider + inference       (1-2 hours)
  ├── 4C: Search + dossier integration  (1-2 hours)
  ├── 4D: Admin config + UI             (1-2 hours)
  ├── 4E: Source badge                  (15 min)
  └── 4F: Signal dedup                  (45 min)

Section 5 (Export History)             ← Independent — can be built in parallel
  ├── 5A: Panel component               (2 hours)
  ├── 5B: API extension                 (30 min)
  ├── 5C: Follow-up nudges              (1 hour)
  └── 5D: Store extension               (30 min)

Section 6 (Session Starter)            ← Depends on Section 5 (follow-up count)
  ├── 6A: Insights API                  (1 hour)
  └── 6B: Home page card                (1-2 hours)
```

**Parallel tracks:**
- Track A: Sections 1 → 2 → 3 (outreach chain)
- Track B: Sections 4 + 5 (independent, can run alongside Track A)
- Track C: Section 6 (after Section 5)

---

## Key Files Quick Reference

| What | File | Status |
|------|------|--------|
| Types | `src/lib/navigator/types.ts` | Extend |
| Channel config | `src/lib/navigator/outreach/channelConfig.ts` | NEW |
| Outreach prompts | `src/lib/navigator/llm/outreachPrompts.ts` | NEW |
| Email prompts (shared context) | `src/lib/navigator/llm/emailPrompts.ts` | Refactor: extract `buildProspectContext` |
| Outreach API | `src/app/api/outreach/draft/route.ts` | NEW |
| OutreachDraftModal | `src/components/navigator/outreach/OutreachDraftModal.tsx` | NEW |
| Template suggestion | `src/lib/navigator/outreach/suggestTemplate.ts` | NEW |
| Action recommendation | `src/lib/navigator/outreach/recommendAction.ts` | NEW |
| NewsAPI provider | `src/lib/navigator/providers/newsapi.ts` | NEW |
| Signal merge | `src/lib/navigator/providers/signalMerge.ts` | NEW |
| Export history panel | `src/components/navigator/exports/ExportedContactsPanel.tsx` | NEW |
| Follow-up nudges | `src/components/navigator/shared/FollowUpNudges.tsx` | NEW |
| Session starter | `src/components/navigator/home/SessionStarterCard.tsx` | NEW |
| Session insights API | `src/app/api/session/insights/route.ts` | NEW |
| DossierHeader | `src/components/navigator/dossier/DossierHeader.tsx` | Extend (add RecommendedActionBar) |
| ContactCard | `src/components/navigator/cards/ContactCard.tsx` | Extend (swap EmailDraftModal → OutreachDraftModal) |
| Store | `src/lib/navigator/store.ts` | Extend |
| Admin config types | `src/lib/navigator/types.ts` (AdminConfig) | Extend |
| Mock data | `src/lib/navigator/mock-data.ts` | Extend |
| Source badge | `src/components/navigator/badges/SourceBadge.tsx` | Extend (add "N") |
| Admin sections | `src/components/navigator/admin/` | NEW: OutreachChannelsSection, OutreachSuggestionsSection, ActionRecommendationsSection, NewsApiSection |
| Search route | `src/app/api/search/companies/route.ts` | Extend (add NewsAPI parallel) |
| Signals route | `src/app/api/company/[domain]/signals/route.ts` | Extend (merge NewsAPI) |
| Home page | `src/app/(navigator)/page.tsx` | Extend (add SessionStarterCard) |

---

## Unresolved Questions

1. **Writing rules persistence:** Store per-user in `user_settings` (Supabase) or just session-only (Zustand)? Recommend: Zustand for now, promote to DB if reps use it heavily.
2. **Outreach draft history UI:** Should drafted messages show in the dossier's contact section? Recommend: yes, as a tiny "1 draft" badge on the contact row, expandable.
3. **NewsAPI plan:** Free tier = 100 req/day. Enough for MVP? Probably yes if caching 6h. If team does 15 searches/day × 10 companies = 150 calls without cache. Need paid plan ($449/mo) or aggressive caching.
4. **Sequence generation (multi-touch):** Mentioned in initial analysis but not scoped here. Should we add a "Generate 4-touch sequence" button that produces all messages at once? Defer or include?
5. **Per-user channel defaults:** Should reps be able to set their preferred default channel in settings? Recommend: yes, add to `UserSettings.defaultOutreachChannel`.
