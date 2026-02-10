import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry, HttpError, defaultRetryOn, computeDelay } from "@/lib/navigator/retry";

// Suppress console.error noise during retry logging
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("withRetry", () => {
  it("succeeds on first try without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 and succeeds on 2nd attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(500, "Internal Server Error"))
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 and succeeds on 3rd attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(429, "Too Many Requests"))
      .mockRejectedValueOnce(new HttpError(429, "Too Many Requests"))
      .mockResolvedValue("finally");

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 });
    expect(result).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after maxRetries exhausted", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new HttpError(503, "Service Unavailable"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 5 })
    ).rejects.toThrow("503 Service Unavailable");
    // 1 initial + 2 retries = 3 total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 400 Bad Request", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(400, "Bad Request"));

    await expect(
      withRetry(fn, { baseDelayMs: 1 })
    ).rejects.toThrow("400 Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 401 Unauthorized", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(401, "Unauthorized"));

    await expect(
      withRetry(fn, { baseDelayMs: 1 })
    ).rejects.toThrow("401 Unauthorized");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 403 Forbidden", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(403, "Forbidden"));

    await expect(
      withRetry(fn, { baseDelayMs: 1 })
    ).rejects.toThrow("403 Forbidden");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 404 Not Found", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(404, "Not Found"));

    await expect(
      withRetry(fn, { baseDelayMs: 1 })
    ).rejects.toThrow("404 Not Found");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on network error (TypeError with fetch)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue("after-network-error");

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 });
    expect(result).toBe("after-network-error");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns the successful result after retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(502, "Bad Gateway"))
      .mockResolvedValue({ data: [1, 2, 3] });

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 });
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it("uses custom retryOn function", async () => {
    // Custom: only retry if message contains "temporary"
    const customRetryOn = (err: unknown) =>
      err instanceof Error && err.message.includes("temporary");

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue("custom-ok");

    const result = await withRetry(fn, {
      retryOn: customRetryOn,
      baseDelayMs: 1,
      maxDelayMs: 5,
    });
    expect(result).toBe("custom-ok");
    expect(fn).toHaveBeenCalledTimes(2);

    // A non-matching error should NOT be retried
    const fn2 = vi.fn().mockRejectedValue(new Error("permanent failure"));
    await expect(
      withRetry(fn2, {
        retryOn: customRetryOn,
        baseDelayMs: 1,
        maxDelayMs: 5,
      })
    ).rejects.toThrow("permanent failure");
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it("retries on all 5xx status codes (500-504)", async () => {
    for (const status of [500, 501, 502, 503, 504]) {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new HttpError(status, "Server Error"))
        .mockResolvedValue("ok");
      const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });
});

describe("computeDelay", () => {
  it("applies exponential backoff", () => {
    // We test multiple times and check the base pattern (before jitter)
    // Jitter adds 0-25% of capped delay, so results are in a range
    const base = 500;
    const max = 5000;

    // Attempt 0: base * 2^0 = 500, jitter range: [500, 625]
    const d0 = computeDelay(0, base, max);
    expect(d0).toBeGreaterThanOrEqual(500);
    expect(d0).toBeLessThanOrEqual(625);

    // Attempt 1: base * 2^1 = 1000, jitter range: [1000, 1250]
    const d1 = computeDelay(1, base, max);
    expect(d1).toBeGreaterThanOrEqual(1000);
    expect(d1).toBeLessThanOrEqual(1250);

    // Attempt 2: base * 2^2 = 2000, jitter range: [2000, 2500]
    const d2 = computeDelay(2, base, max);
    expect(d2).toBeGreaterThanOrEqual(2000);
    expect(d2).toBeLessThanOrEqual(2500);
  });

  it("respects maxDelayMs cap", () => {
    // Attempt 10: base * 2^10 = 512000, but capped to 5000
    // Jitter range: [5000, 6250]
    const delay = computeDelay(10, 500, 5000);
    expect(delay).toBeGreaterThanOrEqual(5000);
    expect(delay).toBeLessThanOrEqual(6250);
  });

  it("adds jitter (randomness)", () => {
    // Run many times and verify not all values are identical
    const delays = Array.from({ length: 20 }, () => computeDelay(0, 500, 5000));
    const unique = new Set(delays);
    // With 20 samples, we'd expect at least 2 distinct values due to Math.random
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("defaultRetryOn", () => {
  it("returns true for TypeError with fetch", () => {
    expect(defaultRetryOn(new TypeError("fetch failed"))).toBe(true);
    expect(defaultRetryOn(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("returns true for 429", () => {
    expect(defaultRetryOn(new HttpError(429, "Too Many Requests"))).toBe(true);
  });

  it("returns true for 500-504", () => {
    expect(defaultRetryOn(new HttpError(500, "Internal Server Error"))).toBe(true);
    expect(defaultRetryOn(new HttpError(502, "Bad Gateway"))).toBe(true);
    expect(defaultRetryOn(new HttpError(503, "Service Unavailable"))).toBe(true);
    expect(defaultRetryOn(new HttpError(504, "Gateway Timeout"))).toBe(true);
  });

  it("returns false for 400/401/403/404", () => {
    expect(defaultRetryOn(new HttpError(400, "Bad Request"))).toBe(false);
    expect(defaultRetryOn(new HttpError(401, "Unauthorized"))).toBe(false);
    expect(defaultRetryOn(new HttpError(403, "Forbidden"))).toBe(false);
    expect(defaultRetryOn(new HttpError(404, "Not Found"))).toBe(false);
  });

  it("returns false for unrelated TypeError", () => {
    expect(defaultRetryOn(new TypeError("Cannot read properties of null"))).toBe(false);
  });

  it("returns false for generic Error", () => {
    expect(defaultRetryOn(new Error("something broke"))).toBe(false);
  });
});

describe("HttpError", () => {
  it("carries status and statusText", () => {
    const err = new HttpError(429, "Too Many Requests");
    expect(err.status).toBe(429);
    expect(err.statusText).toBe("Too Many Requests");
    expect(err.message).toBe("429 Too Many Requests");
    expect(err.name).toBe("HttpError");
    expect(err).toBeInstanceOf(Error);
  });
});
