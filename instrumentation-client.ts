import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0, // 8-10 users — sample everything
  replaysSessionSampleRate: 0, // don't record normal sessions
  replaysOnErrorSampleRate: 1.0, // always capture replay on error
  integrations: [
    Sentry.replayIntegration(),
  ],
  beforeSend(event) {
    // Filter browser noise
    const msg = event.exception?.values?.[0]?.value ?? "";
    if (
      msg.includes("ResizeObserver loop") ||
      msg === "Failed to fetch" ||
      msg === "Load failed"
    ) {
      return null;
    }
    return event;
  },
});
