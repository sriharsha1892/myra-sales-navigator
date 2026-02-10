/**
 * Server-side usage event tracking.
 *
 * Writes directly to Supabase — use this from API routes instead of
 * the client-side `trackUsageEvent()` which does an HTTP round-trip.
 *
 * Fire-and-forget: never blocks the caller, never throws.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { UsageEventType } from "./analytics";

/**
 * Server-side: inserts directly into Supabase `usage_events` table.
 * Fire-and-forget — callers should NOT await this.
 */
export function trackUsageEventServer(
  eventType: UsageEventType,
  userName: string,
  metadata?: Record<string, unknown>
): void {
  try {
    const supabase = createServerClient();
    supabase
      .from("usage_events")
      .insert({
        event_type: eventType,
        user_name: userName,
        metadata: metadata ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("[Analytics] Failed to track event:", error.message);
        }
      });
  } catch {
    // Never throw — analytics is non-critical
  }
}
