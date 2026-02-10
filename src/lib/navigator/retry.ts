// ---------------------------------------------------------------------------
// Shared retry utility with exponential backoff + jitter
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of retries (default 2, so 3 total attempts) */
  maxRetries?: number;
  /** Base delay in milliseconds (default 500) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default 5000) */
  maxDelayMs?: number;
  /** Predicate: which errors should trigger a retry (default: network + 429 + 5xx) */
  retryOn?: (error: unknown) => boolean;
  /** Label for log messages (e.g., "Apollo", "Exa") */
  label?: string;
}

/** Error wrapper that carries an HTTP status code from a failed fetch response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string
  ) {
    super(`${status} ${statusText}`);
    this.name = "HttpError";
  }
}

/**
 * Default retryOn predicate:
 * - Network errors (TypeError with "fetch" in message)
 * - 429 Too Many Requests
 * - 500, 502, 503, 504 server errors
 * Does NOT retry: 400, 401, 403, 404, or other client errors.
 */
export function defaultRetryOn(error: unknown): boolean {
  // Network errors (e.g., DNS failure, connection refused)
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return true;
  }

  // HTTP status-based retries
  if (error instanceof HttpError) {
    const { status } = error;
    if (status === 429) return true;
    if (status >= 500 && status <= 504) return true;
    return false;
  }

  return false;
}

/**
 * Compute delay with exponential backoff + jitter.
 * delay = min(baseDelay * 2^attempt, maxDelay) + random jitter (0-25% of delay)
 */
export function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = Math.random() * capped * 0.25;
  return capped + jitter;
}

/**
 * Execute an async function with retry logic and exponential backoff.
 *
 * Usage:
 * ```ts
 * const data = await withRetry(() => fetch(url).then(checkResponse), {
 *   label: "Apollo",
 *   maxRetries: 2,
 * });
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  const maxDelayMs = options?.maxDelayMs ?? 5000;
  const retryOn = options?.retryOn ?? defaultRetryOn;
  const label = options?.label ?? "Retry";

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry if we've exhausted attempts or the error isn't retryable
      if (attempt >= maxRetries || !retryOn(err)) {
        throw err;
      }

      const delay = computeDelay(attempt, baseDelayMs, maxDelayMs);
      const errMsg =
        err instanceof HttpError
          ? `${err.status} ${err.statusText}`
          : err instanceof Error
            ? err.message
            : String(err);

      console.error(
        `[${label}] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${errMsg}`
      );

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Helper to wrap a fetch call: executes fetch, checks the response status,
 * and throws HttpError for non-ok responses so withRetry can evaluate them.
 *
 * Returns the Response object on success.
 */
export async function fetchWithThrow(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new HttpError(res.status, res.statusText);
  }
  return res;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
