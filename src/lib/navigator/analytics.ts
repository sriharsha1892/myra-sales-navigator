/**
 * Usage analytics — client-side tracking helper.
 *
 * Fire-and-forget: never blocks the caller, never throws.
 * For server-side tracking, use `trackUsageEventServer()` which writes
 * directly to Supabase without an HTTP round-trip.
 */

export type UsageEventType =
  | "search"
  | "dossier_view"
  | "export"
  | "draft"
  | "enrollment"
  | "find_similar";

/**
 * Client-side: sends a POST to /api/analytics/events.
 * Fire-and-forget — never blocks the caller.
 */
export function trackUsageEvent(
  eventType: UsageEventType,
  userName: string,
  metadata?: Record<string, unknown>
): void {
  try {
    fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, userName, metadata }),
    }).catch(() => {}); // swallow errors
  } catch {
    // Never throw — analytics is non-critical
  }
}
