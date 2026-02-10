/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";

// ---------------------------------------------------------------------------
// Environment stubs — BEFORE any module import
// ---------------------------------------------------------------------------

vi.stubEnv("SERPER_API_KEY", "test-serper-key");

// Mock cache (real in-memory cache)
// Mock sentry + health (fire-and-forget, non-critical)
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

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ---------------------------------------------------------------------------
// Dynamic imports
// ---------------------------------------------------------------------------

let searchSerper: typeof import("@/lib/navigator/providers/serper").searchSerper;
let isSerperAvailable: typeof import("@/lib/navigator/providers/serper").isSerperAvailable;

beforeEach(async () => {
  vi.stubEnv("SERPER_API_KEY", "test-serper-key");
  fetchMock.mockReset();
  await clearCache();
  vi.resetModules();
  const mod = await import("@/lib/navigator/providers/serper");
  searchSerper = mod.searchSerper;
  isSerperAvailable = mod.isSerperAvailable;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSerperResponse(opts: {
  organic?: Array<{ title: string; link: string; snippet: string; position: number }>;
  knowledgeGraph?: Record<string, unknown>;
} = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      organic: opts.organic ?? [],
      knowledgeGraph: opts.knowledgeGraph,
      searchParameters: { q: "test" },
    }),
    text: async () => "",
    headers: new Headers(),
  };
}

function makeOrganic(title: string, link: string, position = 1) {
  return { title, link, snippet: `Info about ${title}`, position };
}

// ===========================================================================
// isSerperAvailable
// ===========================================================================

describe("isSerperAvailable", () => {
  it("returns true when SERPER_API_KEY is set", () => {
    expect(isSerperAvailable()).toBe(true);
  });

  it("returns false when SERPER_API_KEY is empty", async () => {
    vi.stubEnv("SERPER_API_KEY", "");
    vi.resetModules();
    const mod = await import("@/lib/navigator/providers/serper");
    expect(mod.isSerperAvailable()).toBe(false);
  });
});

// ===========================================================================
// searchSerper — not available
// ===========================================================================

describe("searchSerper — not available", () => {
  it("returns empty result when API key is missing", async () => {
    vi.stubEnv("SERPER_API_KEY", "");
    vi.resetModules();
    const mod = await import("@/lib/navigator/providers/serper");
    const result = await mod.searchSerper("BASF");
    expect(result.companies).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// searchSerper — happy path
// ===========================================================================

describe("searchSerper — happy path", () => {
  it("returns mapped companies from organic results", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("BASF SE", "https://www.basf.com", 1),
        makeOrganic("Dow Chemical", "https://dow.com/about", 2),
      ],
    }));
    const result = await searchSerper("BASF");
    expect(result.companies).toHaveLength(2);
    expect(result.companies[0].domain).toBe("basf.com");
    expect(result.companies[0].name).toBe("BASF SE");
    expect(result.companies[0].source).toBe("serper");
    expect(result.companies[0].sources).toEqual(["serper"]);
    expect(result.signals).toEqual([]);
    expect(result.cacheHit).toBe(false);
  });

  it("sends correct headers with API key", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({ organic: [] }));
    await searchSerper("test query");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://google.serper.dev/search");
    expect(opts.method).toBe("POST");
    expect(opts.headers["X-API-KEY"]).toBe("test-serper-key");
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("sends correct body with query and num", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({ organic: [] }));
    await searchSerper("food companies", 15);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.q).toBe("food companies");
    expect(body.num).toBe(15);
  });

  it("defaults to 10 results when numResults not specified", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({ organic: [] }));
    await searchSerper("test");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.num).toBe(10);
  });
});

// ===========================================================================
// searchSerper — noise filtering
// ===========================================================================

describe("searchSerper — noise filtering", () => {
  it("filters out noise domains (linkedin, wikipedia, etc)", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("BASF - Wikipedia", "https://en.wikipedia.org/wiki/BASF", 1),
        makeOrganic("BASF LinkedIn", "https://www.linkedin.com/company/basf", 2),
        makeOrganic("BASF Official", "https://www.basf.com", 3),
      ],
    }));
    const result = await searchSerper("BASF");
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].domain).toBe("basf.com");
  });
});

// ===========================================================================
// searchSerper — title cleaning
// ===========================================================================

describe("searchSerper — title cleaning", () => {
  it("strips Wikipedia suffix from title", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("Acme Corp - Wikipedia", "https://acme.com", 1),
      ],
    }));
    const result = await searchSerper("Acme");
    expect(result.companies[0].name).toBe("Acme Corp");
  });

  it("strips LinkedIn suffix from title", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("Acme Corp | LinkedIn", "https://acme.com", 1),
      ],
    }));
    const result = await searchSerper("Acme");
    expect(result.companies[0].name).toBe("Acme Corp");
  });
});

// ===========================================================================
// searchSerper — knowledge graph
// ===========================================================================

describe("searchSerper — knowledge graph", () => {
  it("marks existing company as exactMatch when KG website matches", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("BASF", "https://www.basf.com/about", 1),
      ],
      knowledgeGraph: {
        title: "BASF SE",
        description: "German chemical company",
        website: "https://www.basf.com",
      },
    }));
    const result = await searchSerper("BASF");
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].name).toBe("BASF SE");
    expect(result.companies[0].description).toBe("German chemical company");
    expect(result.companies[0].exactMatch).toBe(true);
  });

  it("adds KG company to front when not in organic results", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("Some Review of BASF", "https://reviews.example.com", 1),
      ],
      knowledgeGraph: {
        title: "BASF SE",
        description: "German chemical company",
        website: "https://www.basf.com",
      },
    }));
    const result = await searchSerper("BASF");
    // KG company should be first
    expect(result.companies[0].domain).toBe("basf.com");
    expect(result.companies[0].exactMatch).toBe(true);
    expect(result.companies[0].name).toBe("BASF SE");
  });

  it("does not add KG if website is a noise domain", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("Acme Corp", "https://acme.com", 1),
      ],
      knowledgeGraph: {
        title: "BASF",
        description: "Chemical company",
        website: "https://en.wikipedia.org/wiki/BASF",
      },
    }));
    const result = await searchSerper("BASF");
    // KG points to wikipedia (noise), should not add it
    expect(result.companies.every(c => c.domain !== "en.wikipedia.org")).toBe(true);
  });
});

// ===========================================================================
// searchSerper — dedup by root domain
// ===========================================================================

describe("searchSerper — dedup", () => {
  it("deduplicates results by root domain", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [
        makeOrganic("BASF Main", "https://www.basf.com", 1),
        makeOrganic("BASF Careers", "https://careers.basf.com", 2),
        makeOrganic("BASF Group", "https://basf.com/about", 3),
      ],
    }));
    const result = await searchSerper("BASF");
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].name).toBe("BASF Main");
  });
});

// ===========================================================================
// searchSerper — caching
// ===========================================================================

describe("searchSerper — caching", () => {
  it("returns cached result on second call (no fetch)", async () => {
    fetchMock.mockResolvedValueOnce(makeSerperResponse({
      organic: [makeOrganic("BASF", "https://basf.com", 1)],
    }));

    const first = await searchSerper("BASF");
    expect(first.cacheHit).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await searchSerper("BASF");
    expect(second.cacheHit).toBe(true);
    expect(second.companies).toHaveLength(1);
    // Still only 1 fetch call — second was cache hit
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// searchSerper — HTTP error
// ===========================================================================

describe("searchSerper — HTTP error", () => {
  it("returns empty result on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
      headers: new Headers(),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await searchSerper("test");
    expect(result.companies).toEqual([]);
    expect(result.signals).toEqual([]);
    warnSpy.mockRestore();
  });
});
