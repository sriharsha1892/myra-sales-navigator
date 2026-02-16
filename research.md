# Outreach Task Scheduling — Bug Research Report

**Date**: 2026-02-16
**Scope**: Full audit of the outreach enrollment/execution flow to identify why cancelled/paused tasks still execute.

---

## Root Cause: TOCTOU Race Condition in Execute Endpoint

**File**: `src/app/api/outreach/enrollments/[id]/execute/route.ts`

The primary bug — "cancelled tasks still run" — is a classic **Time-of-Check-Time-of-Use (TOCTOU)** race condition.

### How it works

1. **Line 90-94**: Enrollment is fetched from Supabase (status snapshot taken)
2. **Line 100**: Status is checked: `if (enrollment.status !== "active")` — guard passes
3. **Lines 195-345**: Channel-specific execution runs — LLM email drafting, call talking points, LinkedIn/WhatsApp message generation. This takes **200-500ms+**
4. **Lines 359-469**: Step log marked "completed", enrollment advanced to next step

**The window**: During that 200-500ms of LLM generation (step 3), another request can `pause` or `unenroll` the enrollment. When execution finishes, the mutations in step 4 proceed with a **stale status snapshot** — no re-verification occurs.

### Specific missing guards

**Line 392-401** (enrollment completion update):
```
.update({ status: "completed", ... })
.eq("id", id)
// MISSING: .eq("status", "active")
```

**Line 442-451** (enrollment advance to next step):
```
.update({ current_step: nextStepIndex, next_step_due_at: nextDue, ... })
.eq("id", id)
// MISSING: .eq("status", "active")
```

Both updates will overwrite a paused/unenrolled enrollment because there's no conditional check on current status.

### The rollback helper is also unsafe

**Lines 42-61**: The `rollbackStepLog` function blindly updates the step log status to `"failed"` without verifying the step log's current status. If the step log was already cancelled by a pause/unenroll operation, this overwrites that status.

---

## Bug 2: Pause Doesn't Cancel Pending Step Logs

**File**: `src/app/api/outreach/enrollments/[id]/route.ts`, lines 123-138

When an enrollment is paused:
- Enrollment status is set to `"paused"` ✓
- `next_step_due_at` is **NOT cleared** ✗
- Pending step logs are **NOT marked as paused/cancelled** ✗

**Impact**: The `due-steps` query (`due-steps/route.ts` line 14) filters by `enrollment.status = "active"`, so paused enrollments won't appear in the due steps widget. However, if any in-flight execution is already running (TOCTOU window), it will complete and advance the enrollment despite being paused.

**Fix**: On pause, also:
1. Clear `next_step_due_at` (set to null)
2. Mark any `"pending"` step logs for this enrollment as `"cancelled"`

---

## Bug 3: Unenroll Doesn't Clean Up Step Logs

**File**: `src/app/api/outreach/enrollments/[id]/route.ts`, lines 157-172

When an enrollment is unenrolled:
- Enrollment status is set to `"unenrolled"` ✓
- `next_step_due_at` is **NOT cleared** ✗
- Pending step logs are **NOT cancelled** ✗

**Impact**: Same TOCTOU issue as pause. Additionally, orphaned `"pending"` step logs remain in the database, which could cause confusion in reporting or if the query logic ever changes.

**Fix**: On unenroll, also:
1. Clear `next_step_due_at` (set to null)
2. Mark any `"pending"` step logs for this enrollment as `"cancelled"`

---

## Bug 4: Resume Doesn't Recalculate `next_step_due_at`

**File**: `src/app/api/outreach/enrollments/[id]/route.ts`, lines 140-155

When an enrollment is resumed:
- Status is set back to `"active"` ✓
- `next_step_due_at` is **NOT recalculated** ✗

**Impact**: If an enrollment was paused for 3 days and then resumed, `next_step_due_at` still holds the original date from before the pause. This means:
- The step immediately appears as "overdue" in the due steps widget
- The delay between steps (e.g., "wait 2 days") is effectively ignored for the paused period

**Fix**: On resume, recalculate `next_step_due_at` from the current timestamp + the step's configured delay.

---

## Bug 5: Advance Action Has Multiple Unchecked Operations

**File**: `src/app/api/outreach/enrollments/[id]/route.ts`, lines 174-259

The manual "advance" action (skip to next step) has three issues:

1. **Line 198**: Step log update (marking current step as "skipped") — return value is not checked for errors
2. **Line 238**: Next step log insert — return value is not checked for errors
3. **Line 220-230**: Enrollment update lacks `.eq("status", "active")` — can advance a paused/unenrolled enrollment

**Impact**: Silent failures leave the enrollment in an inconsistent state (advanced in the enrollment record but step logs don't match).

---

## Bug 6: DueStepsWidget Never Re-fetches

**File**: `src/components/navigator/outreach/DueStepsWidget.tsx`

### The fetch pattern

**Lines 67-89**: The widget uses raw `fetch()` + `useState` instead of React Query:
```typescript
const fetchDueSteps = useCallback(() => {
  fetch(`/api/outreach/due-steps`).then(...)
}, []);
useEffect(() => { fetchDueSteps(); }, [fetchDueSteps]);
```

This means:
- Data is fetched **once on mount** and never again
- There is no polling interval
- `queryClient.invalidateQueries({ queryKey: ["enrollments"] })` (called at lines 141, 174, 182 after execute/skip/snooze) does **NOT** trigger a re-fetch because the widget doesn't use React Query

### The optimistic removal problem

**Line 92**: `removeItem` removes the executed item from local state. But if the execution fails server-side, the item is gone from the UI with no way to recover without a full page refresh.

**Fix**: Convert to React Query with a `["due-steps"]` query key. After execute/skip/snooze, invalidate `["due-steps"]` alongside `["enrollments"]`. Add a polling interval (e.g., 30s) for background freshness.

---

## Bug 7: Enrollment Creation Step Log Insert Unchecked

**File**: `src/app/api/outreach/enrollments/route.ts`, line 161-166

When creating a single enrollment:
```typescript
await supabase.from("outreach_step_logs").insert({
  enrollment_id: enrollment.id, step_index: 0,
  channel: steps[0].channel, status: "pending",
});
```

The insert result is **not checked for errors**. If it fails, the enrollment exists but has no step log — it becomes an orphan that never appears in due steps and can never execute.

**In bulk creation**: The step log insert failure is explicitly marked as "non-fatal" in comments, creating the same orphan problem at scale.

---

## Bug 8: Due-Steps Query Has No Lower Date Bound

**File**: `src/app/api/outreach/due-steps/route.ts`, line 9

```typescript
const today = new Date().toISOString().split("T")[0] + "T23:59:59.999Z";
// Filters: next_step_due_at <= today AND status = "active"
```

There is no lower bound on the date filter. Enrollments that became overdue weeks or months ago will keep appearing in the due steps list forever, cluttering the widget with stale items.

**Fix**: Add a lower bound, e.g., `.gte("next_step_due_at", thirtyDaysAgo)` to filter out ancient overdue items, or at minimum sort them separately.

---

## Bug 9: Bulk Enrollment Dedup Is Incomplete

**File**: `src/app/api/outreach/enrollments/route.ts` (bulk creation logic)

The dedup check only looks for enrollments with status `"active"` or `"paused"`. A contact who previously completed a sequence can be re-enrolled in the same sequence immediately.

**Impact**: Depending on business intent, this may or may not be a bug. If sequences should be one-time-per-contact-per-sequence, the dedup should also check `"completed"` status (possibly with a time window).

---

## Summary Table

| # | Bug | Severity | File | Lines |
|---|-----|----------|------|-------|
| 1 | TOCTOU race: execute proceeds after pause/unenroll | **Critical** | execute/route.ts | 100, 392, 442 |
| 2 | Pause doesn't cancel pending step logs or clear due date | High | enrollments/[id]/route.ts | 123-138 |
| 3 | Unenroll doesn't clean up step logs or clear due date | High | enrollments/[id]/route.ts | 157-172 |
| 4 | Resume doesn't recalculate next_step_due_at | Medium | enrollments/[id]/route.ts | 140-155 |
| 5 | Advance action: unchecked DB ops + no status guard | Medium | enrollments/[id]/route.ts | 174-259 |
| 6 | DueStepsWidget: fetch-once, no React Query, stale UI | Medium | DueStepsWidget.tsx | 67-89 |
| 7 | Enrollment creation: step log insert unchecked | Medium | enrollments/route.ts | 161 |
| 8 | Due-steps query: no lower date bound | Low | due-steps/route.ts | 9 |
| 9 | Bulk dedup: completed enrollments can re-enroll | Low | enrollments/route.ts | bulk logic |

---

## Recommended Fix Priority

### Phase 1 — Fix the "cancelled tasks still run" bug (Bugs 1-3)

1. Add `.eq("status", "active")` to ALL enrollment update calls in execute/route.ts (lines 392, 442)
2. After the status guard, check if 0 rows were updated — if so, abort and return an error
3. In pause handler: clear `next_step_due_at`, cancel pending step logs
4. In unenroll handler: clear `next_step_due_at`, cancel pending step logs

### Phase 2 — Data consistency (Bugs 4-5, 7)

5. In resume handler: recalculate `next_step_due_at` from now + step delay
6. In advance handler: add error checks on step log ops + status guard
7. In enrollment creation: check step log insert result, rollback enrollment if it fails

### Phase 3 — Frontend freshness (Bug 6)

8. Convert DueStepsWidget to React Query with `["due-steps"]` key
9. Invalidate `["due-steps"]` after execute/skip/snooze
10. Add 30s polling interval

### Phase 4 — Cleanup (Bugs 8-9)

11. Add lower date bound to due-steps query
12. Decide on bulk dedup policy for completed enrollments
