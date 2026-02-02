# myRA Sales Navigator -- Project & Database Architecture

## 1. What is myRA Sales Navigator?

myRA Sales Navigator is an internal B2B prospecting tool built for a 12-person sales team that sells into the food ingredients, chemicals, pharma, and packaging industries.

The workflow:

1. **Search** -- A salesperson enters filters (industry vertical, company size, region, buying signals) and the app queries paid external APIs to find matching companies.
2. **Score** -- Each company is scored against an Ideal Customer Profile (ICP). The ICP is a weighted formula the team configures (e.g., "vertical match = 25 pts, size in sweet spot = 20 pts, has buying signals = 15 pts"). Scores range 0--100.
3. **Triage** -- Results appear in a filterable list. The team can drill into a company to see contacts, buying signals (funding rounds, hiring sprees, facility expansions), and CRM status.
4. **Act** -- Users annotate companies with notes, verify contact emails, exclude bad-fit companies, and export prospect lists to CSV or clipboard for outreach.

**Current state:** The app's UI and data model are complete, but everything runs on mock data held in browser memory. Nothing persists across page reloads. The database schema exists and is ready to deploy, but no reads or writes are wired up yet.

---

## 2. What data exists in the app?

The app works with nine categories of data. Each falls into one of three buckets:

| # | Data category | What it holds | Bucket |
|---|---|---|---|
| 1 | **Admin config** | ICP scoring weights, target verticals, company-size sweet spot, signal type definitions, team roster, API cache durations, contact copy-format templates | Team-shared config |
| 2 | **Exclusions** | Companies, domains, or email addresses the team has permanently disqualified (with a reason and who added it) | Team-shared config |
| 3 | **Search presets** | Named saved-filter combinations (e.g., "High-Value Food Ingredients" = vertical: food + ICP >= 80) | Team-shared config |
| 4 | **Company notes** | Free-text annotations attached to a company by a team member | User-generated content |
| 5 | **User settings** | Per-person preferences: default view, default sort, panel widths, recently viewed companies, preferred copy format | User-generated content |
| 6 | **Search history** | Log of past searches: who searched, what filters, how many results, optional label | User-generated content |
| 7 | **Companies** | The core prospect records: name, domain, industry, vertical, employee count, location, ICP score, HubSpot CRM status, data sources, logo, revenue, founding year | External API cache |
| 8 | **Contacts** | People at those companies: name, title, email, phone, LinkedIn URL, email-verification confidence, seniority level, data sources | External API cache |
| 9 | **Signals** | Buying signals tied to companies: type (hiring / funding / expansion / news), headline, description, date, source URL | External API cache |

---

## 3. Where does the data come from?

### External APIs (paid, rate-limited)

| Provider | What it returns | Used for |
|---|---|---|
| **Exa** | Company search results + buying signals | Primary discovery -- find companies matching a query |
| **Apollo** | Company enrichment + contact details | Enrich a company record, find decision-makers |
| **HubSpot** | CRM deal status + existing contacts | Check whether a prospect is already in the pipeline |
| **Clearout** | Email verification verdicts | Validate contact emails before outreach |

All four integrations are currently stubbed (placeholder code, no live API calls yet). Each has its own configurable cache TTL (Exa: 60 min, Apollo: 120 min, HubSpot: 30 min, Clearout: 24 hr).

### User input

Notes, exclusions, settings, presets, and search history are all created by team members through the UI.

### Computed

- **ICP scores** are calculated from the weighted formula in admin config. The weights are configurable; the calculation is deterministic given a company's attributes.
- **Deduplication** merges company records that share a domain across data sources (e.g., the same company found via Exa and Apollo).

---

## 4. Database options on the table

### Option A: Full database (store everything)

Every search result, every contact, every signal goes straight to the database the moment the API returns it.

**Pros:**
- Complete history of every company the team has ever seen
- Any team member can browse the full prospect pool, even results from someone else's search
- No data lost on page reload

**Cons:**
- Data goes stale. A company's employee count or funding status from six months ago is misleading, and there is no automatic refresh mechanism.
- Unbounded growth. 25 results per search x multiple searches per day x four data sources = thousands of rows quickly, most of which nobody will look at again.
- Over-engineering for a 12-person team that does not need a data warehouse.

### Option B: No database for search results (database only for team state)

The database stores only the things the team explicitly creates: config, exclusions, presets, notes, user settings, search history. Search results (companies, contacts, signals) live in browser memory or a short-lived server-side cache and disappear when the session ends.

**Pros:**
- Simple. The database stays tiny and contains only curated, meaningful data.
- No stale-data problem -- every search hits the APIs fresh (within cache TTL).
- Easy to reason about: "if it's in the DB, a human put it there."

**Cons:**
- No shared prospect pool. If one person finds a great company, others can't see it unless they run the same search.
- Repeated API costs. The same company may be fetched and paid for many times.
- No way to browse "companies we've looked at" -- the history is just filter snapshots, not results.

### Option C: Two-tier approach (recommended)

Separate transient search results from curated prospect data.

**Tier 1 -- KV cache (transient):**
A key-value cache (e.g., Vercel KV / Redis) holds raw API responses keyed by search parameters. Entries auto-expire based on the per-provider TTL in admin config. This is shared across users -- if two people run the same search within the TTL, the second one gets a cache hit instead of a billable API call.

**Tier 2 -- Database (curated):**
The database stores team config (admin config, exclusions, presets) and user content (notes, settings, search history) as in Option B, **plus** companies/contacts/signals that a user has explicitly "graduated" by taking an action:

- Adding a note to a company
- Saving a company to a watchlist
- Verifying a contact's email
- Exporting a company in a prospect list

Once a company is in the database, its contacts and signals come along with it. Future searches that return the same company (matched by domain) update the existing record rather than creating a duplicate.

**Pros:**
- The database stays curated and meaningful -- every company in it is there because a human found it worth keeping.
- API caching is handled at the cache layer with automatic expiry; no stale data accumulates in the DB.
- The team still gets a shared prospect pool, but only of companies someone has vetted.
- The schema already supports this -- no structural changes needed.

**Cons:**
- Slightly more complex write logic. The app needs a clear "save" trigger that promotes a transient search result into a persisted record.
- Edge case: a user adds a note to a company, then the company's API data refreshes. The app needs a policy for merging fresh API data into an existing DB record.

---

## 5. What's already built

| Asset | Status |
|---|---|
| **Supabase schema** | 9 tables defined with columns, types, indexes, and foreign keys. Ready to deploy via `supabase/schema.sql`. |
| **Row-level security** | Configured. Service-role gets full access; anonymous users get read-only on reference tables, read-write on user-owned tables. |
| **Seed data** | 25 companies, 25 contacts, 18 signals, 3 presets, 3 exclusions, full admin config. Matches the mock dataset. |
| **Supabase client utilities** | Browser client (anon key) and server client (service-role key) both implemented. |
| **In-memory cache** | TTL-based cache module ready for swap to Vercel KV. |
| **Deduplication logic** | Domain-based company merging across sources. |
| **API route stubs** | 17 endpoints defined with correct request/response shapes; bodies return mock data. |

The schema supports all three options above. The difference between them is **when and what the app writes to the database**, not the table structure.

---

## 6. Recommendation summary

Where each data type lives and when it gets written under the recommended two-tier approach:

| Data type | Storage | Written when | Shared across team? |
|---|---|---|---|
| Admin config | Database | Admin saves config changes | Yes |
| Exclusions | Database | User excludes a company/domain/email | Yes |
| Search presets | Database | User saves a filter combination | Yes |
| Company notes | Database | User writes a note | Yes |
| User settings | Database | User changes a preference | No (per-user) |
| Search history | Database | User runs a search | No (per-user) |
| Companies (search results) | KV cache | Automatically, on API response | Yes (via cache) |
| Companies (saved) | Database | User takes an action (note, save, verify, export) | Yes |
| Contacts (search results) | KV cache | Automatically, on API response | Yes (via cache) |
| Contacts (saved) | Database | Promoted with their parent company | Yes |
| Signals (search results) | KV cache | Automatically, on API response | Yes (via cache) |
| Signals (saved) | Database | Promoted with their parent company | Yes |
| ICP scores | Computed at read time | Never stored directly; recalculated from current weights + company attributes | N/A |

**The short version:** Config and user content go straight to the database. Search results live in a shared cache that auto-expires. A company "graduates" to the database when someone on the team does something with it. Everything else is computed on the fly.
