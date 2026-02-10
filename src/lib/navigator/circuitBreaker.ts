// ---------------------------------------------------------------------------
// In-memory circuit breaker for search engines
//
// Prevents hammering a failing engine. After FAILURE_THRESHOLD consecutive
// failures the circuit "opens" (blocks calls) for OPEN_DURATION_MS, then
// transitions to "half_open" to allow a single probe request.
// ---------------------------------------------------------------------------

export interface CircuitState {
  state: "closed" | "open" | "half_open";
  failures: number;
  lastFailure: number;
  lastSuccess: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FAILURE_THRESHOLD = 3;
export const OPEN_DURATION_MS = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const _circuits = new Map<string, CircuitState>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the circuit is open (engine should be skipped).
 * Automatically transitions open -> half_open after OPEN_DURATION_MS.
 */
export function isCircuitOpen(engine: string): boolean {
  const cs = _circuits.get(engine);
  if (!cs) return false; // No state = closed (healthy)

  if (cs.state === "open") {
    // Check if enough time has passed to try again
    if (Date.now() - cs.lastFailure >= OPEN_DURATION_MS) {
      cs.state = "half_open";
      return false; // Allow a probe request
    }
    return true; // Still within cooldown
  }

  return false; // closed or half_open
}

/**
 * Record a successful call — resets the circuit to closed.
 */
export function recordSuccess(engine: string): void {
  _circuits.set(engine, {
    state: "closed",
    failures: 0,
    lastFailure: 0,
    lastSuccess: Date.now(),
  });
}

/**
 * Record a failed call — increments failure count,
 * opens the circuit if threshold is reached.
 */
export function recordFailure(engine: string): void {
  const cs = _circuits.get(engine) ?? {
    state: "closed" as const,
    failures: 0,
    lastFailure: 0,
    lastSuccess: 0,
  };

  cs.failures++;
  cs.lastFailure = Date.now();

  if (cs.failures >= FAILURE_THRESHOLD) {
    cs.state = "open";
  }

  _circuits.set(engine, cs);
}

/**
 * Get current circuit state for debugging / testing.
 */
export function getCircuitState(engine: string): CircuitState | undefined {
  return _circuits.get(engine);
}

/**
 * Reset a circuit — for testing.
 */
export function resetCircuit(engine: string): void {
  _circuits.delete(engine);
}
