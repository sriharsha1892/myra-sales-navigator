# Fix: Contacts View + Jarring Blur

## Two Problems

### 1. Contacts view shows nothing
**Root cause**: `contactsByDomain` in the store is only populated when a company dossier is opened (via `useCompanyDossier` hook). When user toggles to "Contacts" view in ResultsList, `Object.values(contactsByDomain).flat()` returns `[]` because no dossiers have been fetched yet.

The search API (`/api/search/companies`) returns only companies, not contacts. Contacts are fetched per-company on dossier open via `/api/company/[domain]/contacts`.

**Fix**: When user switches to contacts view, bulk-fetch contacts for all search result companies (or at least the visible ones). Populate `contactsByDomain` so the flat list renders.

### 2. Backdrop blur too jarring
**Root cause**: `AppShell.tsx:27` renders `backdrop-blur-[2px]` overlay covering the entire screen when slide-over opens. Plus `SlideOverPane.tsx:62` uses `glass-panel` class which applies `backdrop-filter: blur(24px)`. The combination is visually heavy.

**Fix**: Remove the full-screen backdrop overlay. The slide-over panel itself already has its own styling — the overlay blur is redundant and jarring.

---

## Implementation

### File 1: `src/components/layout/ResultsList.tsx`

**Problem**: Contacts view only shows contacts already in `contactsByDomain` (populated only when a specific company dossier was opened). On first toggle to contacts view, this is empty.

**Changes**:
- Add a `useEffect` that triggers when `viewMode === "contacts"` and `searchResults` exist but `contactsByDomain` has few entries
- Bulk-fetch contacts for search result domains via parallel `/api/company/[domain]/contacts` calls (batched, max ~10 concurrent)
- Add a loading state while contacts are being fetched
- Show a meaningful empty state when loading vs truly no contacts

```tsx
// New state
const [contactsLoading, setContactsLoading] = useState(false);
const setContactsForDomain = useStore((s) => s.setContactsForDomain);

// New effect: bulk-fetch contacts when switching to contacts view
useEffect(() => {
  if (viewMode !== "contacts" || !searchResults || searchResults.length === 0) return;

  // Check which domains we don't have contacts for yet
  const missingDomains = searchResults
    .map((c) => c.domain)
    .filter((d) => !contactsByDomain[d]);

  if (missingDomains.length === 0) return;

  setContactsLoading(true);

  // Fetch in batches of 5 to avoid hammering the API
  const batchSize = 5;
  const batches = [];
  for (let i = 0; i < missingDomains.length; i += batchSize) {
    batches.push(missingDomains.slice(i, i + batchSize));
  }

  (async () => {
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(async (domain) => {
          const res = await fetch(`/api/company/${encodeURIComponent(domain)}/contacts`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.contacts?.length > 0) {
            setContactsForDomain(domain, data.contacts);
          }
        })
      );
    }
    setContactsLoading(false);
  })();
}, [viewMode, searchResults]);
```

- In the contacts render section (lines 461-476), add loading skeleton state:
```tsx
) : contactsLoading ? (
  <div className="space-y-1.5">
    <p className="mb-2 text-xs text-text-tertiary">Loading contacts...</p>
    {Array.from({ length: 6 }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
) : sortedContacts.length === 0 ? (
  // existing empty state
```

### File 2: `src/components/layout/AppShell.tsx`

**Problem**: Line 26-28, full-screen `backdrop-blur-[2px]` overlay is jarring.

**Change**: Remove the backdrop overlay entirely. The slide-over panel already has its own `glass-panel` styling with border-left separation.

```diff
-      {/* Backdrop blur when slide-over is open */}
-      {slideOverOpen && (
-        <div className="pointer-events-none absolute inset-0 z-10 bg-black/5 backdrop-blur-[2px] transition-opacity" />
-      )}
```

### File 3: `src/components/layout/SlideOverPane.tsx`

**Problem**: `glass-panel` class applies `backdrop-filter: blur(24px)` which is excessive.

**Change**: Replace `glass-panel` with a solid background. The panel should be opaque — it sits on top of content, it doesn't need to be see-through.

```diff
-      className="glass-panel w-[420px] flex-shrink-0 border-l border-surface-3"
+      className="w-[420px] flex-shrink-0 border-l border-surface-3 bg-surface-0"
```

---

## Files Modified
1. `src/components/layout/ResultsList.tsx` — bulk-fetch contacts on view toggle, loading state
2. `src/components/layout/AppShell.tsx` — remove backdrop overlay
3. `src/components/layout/SlideOverPane.tsx` — replace glass-panel with solid bg

## Verification
- Toggle to Contacts view after a search — contacts should load (with loading skeletons) then display
- Open a company dossier — no jarring blur overlay on the results behind it
- Slide-over panel has clean solid background, no blur artifacts
- `npx tsc --noEmit` passes
