/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Environment stubs — BEFORE any module import
// ---------------------------------------------------------------------------

vi.stubEnv("EXA_API_KEY", "test-exa-key");
vi.stubEnv("GROQ_API_KEY", ""); // disable Groq so signal extraction is skipped

// ---------------------------------------------------------------------------
// Mock Exa SDK
// ---------------------------------------------------------------------------

const mockSearch = vi.fn();

vi.mock("exa-js", () => {
  return {
    default: class MockExa {
      search = mockSearch;
      constructor() {
        // no-op
      }
    },
  };
});

// Mock sentry + health (fire-and-forget)
vi.mock("@/lib/sentry", () => ({
  apiCallBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/navigator/health", () => ({
  logApiCall: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      then: vi.fn(),
    })),
  })),
}));

// Mock LLM client (signal extraction uses Groq)
vi.mock("@/lib/navigator/llm/client", () => ({
  isGroqAvailable: vi.fn(() => false),
  completeJSON: vi.fn(),
  getGroq: vi.fn(),
  getGemini: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Dynamic imports
// ---------------------------------------------------------------------------

let searchExa: typeof import("@/lib/navigator/providers/exa").searchExa;
let isExaAvailable: typeof import("@/lib/navigator/providers/exa").isExaAvailable;
let isNoiseDomain: typeof import("@/lib/navigator/providers/exa").isNoiseDomain;

beforeEach(async () => {
  vi.stubEnv("EXA_API_KEY", "test-exa-key");
  vi.stubEnv("GROQ_API_KEY", "");
  mockSearch.mockReset();
  await clearCache();
  vi.resetModules();
  const mod = await import("@/lib/navigator/providers/exa");
  searchExa = mod.searchExa;
  isExaAvailable = mod.isExaAvailable;
  isNoiseDomain = mod.isNoiseDomain;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExaResult(url: string, title: string, score: number, highlights: string[] = []) {
  return { url, title, author: null, publishedDate: null, highlights, score };
}

function stubExaSearch(companyResults: unknown[], newsResults: unknown[] = []) {
  mockSearch
    .mockResolvedValueOnce({ results: companyResults })  // company search
    .mockResolvedValueOnce({ results: newsResults });     // news search
}

// ===========================================================================
// isExaAvailable
// ===========================================================================

describe("isExaAvailable", () => {
  it("returns true when EXA_API_KEY is set", () => {
    expect(isExaAvailable()).toBe(true);
  });

  it("returns false when EXA_API_KEY is empty", async () => {
    vi.stubEnv("EXA_API_KEY", "");
    vi.resetModules();
    const mod = await import("@/lib/navigator/providers/exa");
    expect(mod.isExaAvailable()).toBe(false);
  });
});

// ===========================================================================
// searchExa — not available
// ===========================================================================

describe("searchExa — not available", () => {
  it("returns empty when EXA_API_KEY not set", async () => {
    vi.stubEnv("EXA_API_KEY", "");
    vi.resetModules();
    const mod = await import("@/lib/navigator/providers/exa");
    const result = await mod.searchExa({ query: "test" });
    expect(result.companies).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// searchExa — happy path
// ===========================================================================

describe("searchExa — happy path", () => {
  it("returns mapped companies from Exa SDK results", async () => {
    stubExaSearch([
      makeExaResult("https://www.basf.com", "BASF SE", 0.92, ["German chemical company"]),
      makeExaResult("https://dow.com", "Dow Chemical", 0.85, ["American chemical company"]),
    ]);
    const result = await searchExa({ query: "chemical companies" });
    expect(result.companies).toHaveLength(2);
    expect(result.companies[0].domain).toBe("basf.com");
    expect(result.companies[0].name).toBe("BASF SE");
    expect(result.companies[0].source).toBe("exa");
    expect(result.companies[0].sources).toEqual(["exa"]);
    expect(result.cacheHit).toBe(false);
  });

  it("captures exaRelevanceScore from result.score", async () => {
    stubExaSearch([
      makeExaResult("https://acme.com", "Acme Corp", 0.87),
    ]);
    const result = await searchExa({ query: "acme" });
    expect(result.companies[0].exaRelevanceScore).toBe(0.87);
  });

  it("description is joined from highlights", async () => {
    stubExaSearch([
      makeExaResult("https://acme.com", "Acme", 0.9, ["First sentence.", "Second sentence."]),
    ]);
    const result = await searchExa({ query: "acme" });
    expect(result.companies[0].description).toBe("First sentence. Second sentence.");
  });

  it("calls Exa SDK search twice (company + news) in parallel", async () => {
    stubExaSearch([
      makeExaResult("https://acme.com", "Acme", 0.9),
    ]);
    await searchExa({ query: "acme" });
    expect(mockSearch).toHaveBeenCalledTimes(2);
    // First call: company search with category "company"
    const firstCallOpts = mockSearch.mock.calls[0][1];
    expect(firstCallOpts.category).toBe("company");
    // Second call: news search with category "news"
    const secondCallOpts = mockSearch.mock.calls[1][1];
    expect(secondCallOpts.category).toBe("news");
  });

  it("over-fetches by 10 to compensate for post-filtering", async () => {
    stubExaSearch([]);
    await searchExa({ query: "test", numResults: 25 });
    const firstCallOpts = mockSearch.mock.calls[0][1];
    expect(firstCallOpts.numResults).toBe(35); // 25 + 10
  });
});

// ===========================================================================
// searchExa — MIN_EXA_RELEVANCE filtering
// ===========================================================================

describe("searchExa — MIN_EXA_RELEVANCE filtering", () => {
  it("filters out results below MIN_EXA_RELEVANCE (0.10)", async () => {
    stubExaSearch([
      makeExaResult("https://good.com", "Good Corp", 0.85),
      makeExaResult("https://marginal.com", "Marginal Corp", 0.12),
      makeExaResult("https://garbage.com", "Garbage Corp", 0.03),
    ]);
    const result = await searchExa({ query: "companies" });
    expect(result.companies).toHaveLength(2);
    expect(result.companies.map(c => c.domain)).toEqual(["good.com", "marginal.com"]);
  });

  it("keeps results with undefined score (treated as passing)", async () => {
    stubExaSearch([
      makeExaResult("https://scored.com", "Scored", 0.50),
      { url: "https://noscore.com", title: "No Score", highlights: [] }, // no score field
    ]);
    const result = await searchExa({ query: "companies" });
    expect(result.companies).toHaveLength(2);
    expect(result.companies.map(c => c.domain)).toContain("noscore.com");
  });

  it("filters out score=0 (below 0.10)", async () => {
    stubExaSearch([
      makeExaResult("https://zero.com", "Zero Score", 0),
    ]);
    const result = await searchExa({ query: "companies" });
    expect(result.companies).toHaveLength(0);
  });
});

// ===========================================================================
// searchExa — noise domain filtering
// ===========================================================================

describe("searchExa — noise domain filtering", () => {
  it("filters out noise domains (linkedin, wikipedia, crunchbase, etc)", async () => {
    stubExaSearch([
      makeExaResult("https://linkedin.com/company/basf", "BASF on LinkedIn", 0.90),
      makeExaResult("https://en.wikipedia.org/wiki/BASF", "BASF - Wikipedia", 0.85),
      makeExaResult("https://crunchbase.com/organization/basf", "BASF", 0.80),
      makeExaResult("https://basf.com", "BASF SE", 0.92),
    ]);
    const result = await searchExa({ query: "BASF" });
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].domain).toBe("basf.com");
  });
});

// ===========================================================================
// searchExa — dedup by getRootDomain
// ===========================================================================

describe("searchExa — dedup by getRootDomain", () => {
  it("deduplicates results by root domain (www.basf.com === basf.com)", async () => {
    stubExaSearch([
      makeExaResult("https://www.basf.com", "BASF Main", 0.92),
      makeExaResult("https://careers.basf.com", "BASF Careers", 0.80),
      makeExaResult("https://basf.com/about", "About BASF", 0.75),
    ]);
    const result = await searchExa({ query: "BASF" });
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].name).toBe("BASF Main");
  });

  it("preserves different TLDs (basf.com vs basf.de)", async () => {
    stubExaSearch([
      makeExaResult("https://basf.com", "BASF US", 0.90),
      makeExaResult("https://basf.de", "BASF DE", 0.88),
    ]);
    const result = await searchExa({ query: "BASF" });
    expect(result.companies).toHaveLength(2);
  });
});

// ===========================================================================
// searchExa — caching
// ===========================================================================

describe("searchExa — caching", () => {
  it("returns cached result on second call", async () => {
    stubExaSearch([
      makeExaResult("https://acme.com", "Acme", 0.90),
    ]);
    const first = await searchExa({ query: "acme" });
    expect(first.cacheHit).toBe(false);
    expect(mockSearch).toHaveBeenCalledTimes(2);

    const second = await searchExa({ query: "acme" });
    expect(second.cacheHit).toBe(true);
    // No additional SDK calls
    expect(mockSearch).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// isNoiseDomain — comprehensive
// ===========================================================================

describe("isNoiseDomain", () => {
  it.each([
    ["linkedin.com", true],
    ["www.linkedin.com", true],      // endsWith(".linkedin.com") matches
    ["business.linkedin.com", true], // endsWith .linkedin.com
    ["facebook.com", true],
    ["twitter.com", true],
    ["x.com", true],
    ["github.com", true],
    ["reddit.com", true],
    ["medium.com", true],
    ["acme.com", false],
    ["basf.com", false],
    ["mycompany.io", false],
  ])("isNoiseDomain('%s') === %s", (domain, expected) => {
    expect(isNoiseDomain(domain)).toBe(expected);
  });
});
