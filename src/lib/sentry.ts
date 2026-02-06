import * as Sentry from "@sentry/nextjs";

/**
 * Set Sentry user context from a user name string (used server-side in API routes).
 */
export function setSentryUser(userName: string | null | undefined) {
  if (userName) {
    Sentry.setUser({ username: userName });
  }
}

/**
 * Add a structured breadcrumb for an external API call.
 * Call before and after each provider request for traceability.
 */
export function apiCallBreadcrumb(
  provider: string,
  action: string,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    category: `provider.${provider}`,
    message: action,
    level: "info",
    data,
  });
}
