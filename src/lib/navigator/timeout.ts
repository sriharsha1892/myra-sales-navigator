// ---------------------------------------------------------------------------
// withTimeout — wraps an async function with an AbortController-based timeout
// ---------------------------------------------------------------------------

/**
 * Error thrown when a withTimeout call exceeds its deadline.
 */
export class TimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Execute `fn` with a timeout. If the function doesn't resolve within
 * `timeoutMs` milliseconds, the AbortController signal is aborted and
 * a `TimeoutError` is thrown.
 *
 * The caller-supplied `fn` receives the AbortSignal so it can pass it
 * to fetch() or other abort-aware APIs.
 *
 * @example
 * const res = await withTimeout(
 *   (signal) => fetch(url, { signal }),
 *   4000,
 *   "Parallel"
 * );
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await fn(controller.signal);
    return result;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new TimeoutError(label, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
