// ---------------------------------------------------------------------------
// Structured error classification for search engines
// ---------------------------------------------------------------------------

import { TimeoutError } from "./timeout";
import { HttpError } from "./retry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "NETWORK_ERROR"
  | "NO_ENGINE_AVAILABLE"
  | "ALL_ENGINES_FAILED"
  | "EMPTY_RESULTS"
  | "UNKNOWN";

export interface SearchErrorDetail {
  code: SearchErrorCode;
  message: string;
  engine?: string;
  retryable: boolean;
  suggestedAction?: string;
}

// ---------------------------------------------------------------------------
// classifyError — map raw errors to SearchErrorDetail
// ---------------------------------------------------------------------------

/**
 * Classify an unknown error into a structured SearchErrorDetail.
 * Used by the search route and engine wrappers to produce consistent
 * error metadata for logging and UI display.
 */
export function classifyError(err: unknown, engine?: string): SearchErrorDetail {
  // Timeout
  if (err instanceof TimeoutError) {
    return {
      code: "TIMEOUT",
      message: err.message,
      engine,
      retryable: true,
      suggestedAction: "Try again — the engine may be slow right now.",
    };
  }

  // HTTP errors
  if (err instanceof HttpError) {
    const { status } = err;

    if (status === 429) {
      return {
        code: "RATE_LIMITED",
        message: err.message,
        engine,
        retryable: true,
        suggestedAction: "Wait 30 seconds",
      };
    }

    if (status === 401 || status === 403) {
      return {
        code: "AUTH_FAILED",
        message: err.message,
        engine,
        retryable: false,
        suggestedAction: "Check API key configuration.",
      };
    }

    if (status >= 500) {
      return {
        code: "UNKNOWN",
        message: err.message,
        engine,
        retryable: true,
        suggestedAction: "Server error — retry shortly.",
      };
    }
  }

  // Network / fetch errors
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return {
      code: "NETWORK_ERROR",
      message: err.message,
      engine,
      retryable: true,
      suggestedAction: "Check network connectivity.",
    };
  }

  // Fallback
  const message = err instanceof Error ? err.message : String(err);
  return {
    code: "UNKNOWN",
    message,
    engine,
    retryable: true,
  };
}
