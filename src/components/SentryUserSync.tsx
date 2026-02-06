"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Syncs the authenticated user name to Sentry for client-side error attribution.
 * Renders nothing — place inside AuthProvider in root layout.
 */
export function SentryUserSync() {
  const { userName } = useAuth();

  useEffect(() => {
    if (userName) {
      Sentry.setUser({ username: userName });
    } else {
      Sentry.setUser(null);
    }
  }, [userName]);

  return null;
}
