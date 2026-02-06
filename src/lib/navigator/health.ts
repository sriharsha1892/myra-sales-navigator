import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiCallLog {
  source: string;
  endpoint: string;
  status_code: number | null;
  success: boolean;
  latency_ms: number | null;
  rate_limit_remaining: number | null;
  error_message: string | null;
  context: Record<string, unknown> | null;
  user_name: string | null;
}

export type SourceHealth = {
  status: "healthy" | "degraded" | "down" | "unknown";
  errorRate: number;
  avgLatency: number;
  lastSuccess: string | null;
  rateLimitRemaining: number | null;
  callCount: number;
};

export interface HealthSummary {
  sources: Record<string, SourceHealth>;
  recentErrors: {
    created_at: string;
    source: string;
    endpoint: string;
    status_code: number | null;
    error_message: string | null;
    context: Record<string, unknown> | null;
  }[];
}

// ---------------------------------------------------------------------------
// logApiCall — fire-and-forget insert (no await at call site)
// ---------------------------------------------------------------------------

export function logApiCall(params: ApiCallLog): void {
  try {
    const supabase = createServerClient();
    supabase
      .from("api_health_log")
      .insert(params)
      .then(({ error }) => {
        if (error) console.warn("[Health] Failed to log API call:", error.message);
      });
  } catch {
    // Never throw — health logging is non-critical
  }
}

// ---------------------------------------------------------------------------
// trackExternalCall — wraps an async fn, measures latency, logs result
// ---------------------------------------------------------------------------

export async function trackExternalCall<T>(
  source: string,
  endpoint: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logApiCall({
      source,
      endpoint,
      status_code: 200,
      success: true,
      latency_ms: Date.now() - start,
      rate_limit_remaining: null,
      error_message: null,
      context: context ?? null,
      user_name: null,
    });
    return result;
  } catch (err) {
    logApiCall({
      source,
      endpoint,
      status_code: null,
      success: false,
      latency_ms: Date.now() - start,
      rate_limit_remaining: null,
      error_message: err instanceof Error ? err.message : String(err),
      context: context ?? null,
      user_name: null,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getHealthSummary — query api_health_log for dashboard
// ---------------------------------------------------------------------------

export async function getHealthSummary(hours: number = 1): Promise<HealthSummary> {
  const supabase = createServerClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Fetch all logs in the time window
  const { data: logs, error } = await supabase
    .from("api_health_log")
    .select("source, endpoint, status_code, success, latency_ms, rate_limit_remaining, error_message, context, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !logs) {
    return { sources: {}, recentErrors: [] };
  }

  // Group by source
  const bySource: Record<string, typeof logs> = {};
  for (const log of logs) {
    if (!bySource[log.source]) bySource[log.source] = [];
    bySource[log.source].push(log);
  }

  const sources: Record<string, SourceHealth> = {};
  for (const [source, entries] of Object.entries(bySource)) {
    const total = entries.length;
    const failures = entries.filter((e) => !e.success).length;
    const errorRate = total > 0 ? (failures / total) * 100 : 0;
    const latencies = entries.filter((e) => e.latency_ms != null).map((e) => e.latency_ms!);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    const lastSuccessEntry = entries.find((e) => e.success);
    const rateLimitEntries = entries.filter((e) => e.rate_limit_remaining != null);
    const latestRateLimit = rateLimitEntries.length > 0 ? rateLimitEntries[0].rate_limit_remaining : null;

    let status: SourceHealth["status"] = "unknown";
    if (total === 0) {
      status = "unknown";
    } else if (errorRate < 5) {
      status = "healthy";
    } else if (errorRate < 20) {
      status = "degraded";
    } else {
      status = "down";
    }

    sources[source] = {
      status,
      errorRate: Math.round(errorRate * 10) / 10,
      avgLatency,
      lastSuccess: lastSuccessEntry?.created_at ?? null,
      rateLimitRemaining: latestRateLimit,
      callCount: total,
    };
  }

  // Recent errors (last 25)
  const recentErrors = logs
    .filter((l) => !l.success)
    .slice(0, 25)
    .map((l) => ({
      created_at: l.created_at,
      source: l.source,
      endpoint: l.endpoint,
      status_code: l.status_code,
      error_message: l.error_message,
      context: l.context,
    }));

  return { sources, recentErrors };
}
