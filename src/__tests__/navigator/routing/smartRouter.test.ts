/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock external dependencies BEFORE any module import
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/providers/exa", () => ({
  isExaAvailable: vi.fn(() => true),
}));

vi.mock("@/lib/navigator/providers/serper", () => ({
  isSerperAvailable: vi.fn(() => true),
}));

vi.mock("@/lib/navigator/providers/parallel", () => ({
  isParallelAvailable: vi.fn(() => true),
}));

vi.mock("@/lib/navigator/health", () => ({
  getHealthSummary: vi.fn(async () => ({
    sources: {},
    recentErrors: [],
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

vi.mock("@/lib/navigator/circuitBreaker", () => ({
  isCircuitOpen: vi.fn(() => false),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  resetCircuit: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test lifecycle: fresh module state per test
// ---------------------------------------------------------------------------

let pickDiscoveryEngine: typeof import("@/lib/navigator/routing/smartRouter").pickDiscoveryEngine;
let pickNameEngine: typeof import("@/lib/navigator/routing/smartRouter").pickNameEngine;
let recordUsage: typeof import("@/lib/navigator/routing/smartRouter").recordUsage;
let isUnderBudget: typeof import("@/lib/navigator/routing/smartRouter").isUnderBudget;
let isExaFallbackAllowed: typeof import("@/lib/navigator/routing/smartRouter").isExaFallbackAllowed;
let getUsageSummary: typeof import("@/lib/navigator/routing/smartRouter").getUsageSummary;

// Import mocked modules for per-test control
let isExaAvailable: ReturnType<typeof vi.fn>;
let isSerperAvailable: ReturnType<typeof vi.fn>;
let isParallelAvailable: ReturnType<typeof vi.fn>;
let getHealthSummary: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("@/lib/navigator/routing/smartRouter");
  pickDiscoveryEngine = mod.pickDiscoveryEngine;
  pickNameEngine = mod.pickNameEngine;
  recordUsage = mod.recordUsage;
  isUnderBudget = mod.isUnderBudget;
  isExaFallbackAllowed = mod.isExaFallbackAllowed;
  getUsageSummary = mod.getUsageSummary;

  const exaMod = await import("@/lib/navigator/providers/exa");
  isExaAvailable = exaMod.isExaAvailable as unknown as ReturnType<typeof vi.fn>;
  isExaAvailable.mockReset().mockReturnValue(true);

  const serperMod = await import("@/lib/navigator/providers/serper");
  isSerperAvailable = serperMod.isSerperAvailable as unknown as ReturnType<typeof vi.fn>;
  isSerperAvailable.mockReset().mockReturnValue(true);

  const parallelMod = await import("@/lib/navigator/providers/parallel");
  isParallelAvailable = parallelMod.isParallelAvailable as unknown as ReturnType<typeof vi.fn>;
  isParallelAvailable.mockReset().mockReturnValue(true);

  const healthMod = await import("@/lib/navigator/health");
  getHealthSummary = healthMod.getHealthSummary as unknown as ReturnType<typeof vi.fn>;
  getHealthSummary.mockReset().mockResolvedValue({ sources: {}, recentErrors: [] });
});

// ===========================================================================
// recordUsage / isUnderBudget
// ===========================================================================

describe("recordUsage + isUnderBudget", () => {
  it("starts with zero usage, all under budget", () => {
    expect(isUnderBudget("exa")).toBe(true);
    expect(isUnderBudget("parallel")).toBe(true);
    expect(isUnderBudget("serper")).toBe(true);
  });

  it("recordUsage increments the count for a source", () => {
    recordUsage("exa");
    recordUsage("exa");
    const summary = getUsageSummary();
    expect(summary.exa.count).toBe(2);
  });

  it("exa over budget after 5 calls (daily budget is 5)", () => {
    for (let i = 0; i < 5; i++) recordUsage("exa");
    expect(isUnderBudget("exa")).toBe(false);
  });

  it("parallel still under budget after 5 calls (daily budget is 800)", () => {
    for (let i = 0; i < 5; i++) recordUsage("parallel");
    expect(isUnderBudget("parallel")).toBe(true);
  });

  it("unknown source is always under budget (defaults to Infinity)", () => {
    expect(isUnderBudget("nonexistent")).toBe(true);
  });
});

// ===========================================================================
// getUsageSummary
// ===========================================================================

describe("getUsageSummary", () => {
  it("returns all three engines with zero counts initially", () => {
    const summary = getUsageSummary();
    expect(summary.exa).toEqual({ count: 0, budget: 5, pctUsed: 0 });
    expect(summary.parallel).toEqual({ count: 0, budget: 800, pctUsed: 0 });
    expect(summary.serper).toEqual({ count: 0, budget: 100, pctUsed: 0 });
  });

  it("pctUsed reflects actual usage", () => {
    recordUsage("exa");
    const summary = getUsageSummary();
    expect(summary.exa.pctUsed).toBe(20); // 1/5 = 20%
  });

  it("count reflects cumulative usage", () => {
    recordUsage("serper");
    recordUsage("serper");
    recordUsage("serper");
    const summary = getUsageSummary();
    expect(summary.serper.count).toBe(3);
  });
});

// ===========================================================================
// isExaFallbackAllowed
// ===========================================================================

describe("isExaFallbackAllowed", () => {
  it("returns true when Exa is available and under budget", () => {
    isExaAvailable.mockReturnValue(true);
    expect(isExaFallbackAllowed()).toBe(true);
  });

  it("returns false when Exa is not available", () => {
    isExaAvailable.mockReturnValue(false);
    expect(isExaFallbackAllowed()).toBe(false);
  });

  it("returns false when Exa is over daily budget", () => {
    isExaAvailable.mockReturnValue(true);
    for (let i = 0; i < 5; i++) recordUsage("exa");
    expect(isExaFallbackAllowed()).toBe(false);
  });
});

// ===========================================================================
// pickDiscoveryEngine
// ===========================================================================

describe("pickDiscoveryEngine", () => {
  it("returns 'parallel' when Parallel is available, healthy, and under budget", async () => {
    expect(await pickDiscoveryEngine()).toBe("parallel");
  });

  it("falls back to 'exa' when Parallel is unavailable", async () => {
    isParallelAvailable.mockReturnValue(false);
    expect(await pickDiscoveryEngine()).toBe("exa");
  });

  it("falls back to 'exa' when Parallel is down (health check)", async () => {
    getHealthSummary.mockResolvedValue({
      sources: {
        parallel: { status: "down", errorRate: 50, avgLatency: 0, lastSuccess: null, rateLimitRemaining: null, callCount: 10 },
      },
      recentErrors: [],
    });
    expect(await pickDiscoveryEngine()).toBe("exa");
  });

  it("returns 'parallel' when Parallel is degraded (not down)", async () => {
    getHealthSummary.mockResolvedValue({
      sources: {
        parallel: { status: "degraded", errorRate: 10, avgLatency: 500, lastSuccess: null, rateLimitRemaining: null, callCount: 10 },
      },
      recentErrors: [],
    });
    expect(await pickDiscoveryEngine()).toBe("parallel");
  });

  it("falls back to 'parallel' (cheaper) when both are over budget", async () => {
    // Exhaust both budgets
    for (let i = 0; i < 5; i++) recordUsage("exa");
    for (let i = 0; i < 800; i++) recordUsage("parallel");
    // Both over budget -> falls back to parallel as the cheaper option
    const engine = await pickDiscoveryEngine();
    expect(engine).toBe("parallel");
  });

  it("returns 'exa' as last resort when Parallel is unavailable and Exa is over budget", async () => {
    isParallelAvailable.mockReturnValue(false);
    for (let i = 0; i < 5; i++) recordUsage("exa");
    expect(await pickDiscoveryEngine()).toBe("exa");
  });
});

// ===========================================================================
// pickNameEngine
// ===========================================================================

describe("pickNameEngine", () => {
  it("returns 'serper' when Serper is available, healthy, and under budget", async () => {
    expect(await pickNameEngine()).toBe("serper");
  });

  it("falls back to 'exa' when Serper is unavailable", async () => {
    isSerperAvailable.mockReturnValue(false);
    expect(await pickNameEngine()).toBe("exa");
  });

  it("falls back to 'exa' when Serper is down (health check)", async () => {
    getHealthSummary.mockResolvedValue({
      sources: {
        serper: { status: "down", errorRate: 50, avgLatency: 0, lastSuccess: null, rateLimitRemaining: null, callCount: 10 },
      },
      recentErrors: [],
    });
    expect(await pickNameEngine()).toBe("exa");
  });

  it("returns 'serper' when degraded (not down)", async () => {
    getHealthSummary.mockResolvedValue({
      sources: {
        serper: { status: "degraded", errorRate: 10, avgLatency: 500, lastSuccess: null, rateLimitRemaining: null, callCount: 10 },
      },
      recentErrors: [],
    });
    expect(await pickNameEngine()).toBe("serper");
  });

  it("falls back to 'serper' (cheaper) when both are over budget", async () => {
    for (let i = 0; i < 100; i++) recordUsage("serper");
    for (let i = 0; i < 5; i++) recordUsage("exa");
    const engine = await pickNameEngine();
    expect(engine).toBe("serper");
  });

  it("returns 'exa' as last resort when Serper is unavailable and Exa is over budget", async () => {
    isSerperAvailable.mockReturnValue(false);
    for (let i = 0; i < 5; i++) recordUsage("exa");
    expect(await pickNameEngine()).toBe("exa");
  });
});
