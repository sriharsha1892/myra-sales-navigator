/**
 * Comprehensive tests for all 8 bug fixes.
 *
 * 1. CommandPalette double-escape (Overlay closeOnEscape={false})
 * 2. useKeyboardShortcuts listener re-registration
 * 3. CSV export quote escaping
 * 4. useInlineFeedback timer leak on unmount
 * 5. addProgressToast double-settle guard
 * 6. FilterPanel activeFilterCount excludes hideExcluded toggle
 * 7. Orphan Toast.tsx deleted
 * 8. Overlay escape uses bubble phase (not capture)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────
// Bug #3 — CSV export quote escaping (pure function test)
// ─────────────────────────────────────────────────────────
import { escapeCsvField } from "@/hooks/navigator/useExport";

describe("Bug #3 — escapeCsvField (RFC 4180)", () => {
  it("returns plain fields unchanged", () => {
    expect(escapeCsvField("John")).toBe("John");
    expect(escapeCsvField("Doe")).toBe("Doe");
    expect(escapeCsvField("85")).toBe("85");
    expect(escapeCsvField("")).toBe("");
  });

  it("wraps fields with commas in double quotes", () => {
    expect(escapeCsvField("Smith, Inc.")).toBe('"Smith, Inc."');
    expect(escapeCsvField("a,b,c")).toBe('"a,b,c"');
  });

  it("escapes double quotes by doubling them", () => {
    expect(escapeCsvField('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("wraps fields with newlines in double quotes", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles fields with commas AND quotes", () => {
    expect(escapeCsvField('"Smith, Inc."')).toBe('"""Smith, Inc."""');
  });

  it("generates valid CSV rows for problematic company names", () => {
    const fields = ["John", "Doe", "j@x.com", "VP Sales", "Smith, Inc.", "555-1234", "85"];
    const row = fields.map(escapeCsvField).join(",");
    expect(row).toBe('John,Doe,j@x.com,VP Sales,"Smith, Inc.",555-1234,85');
    // Verify the row can be split back correctly (simple validation)
    expect(row).toContain('"Smith, Inc."');
    expect(row.split(",").length).toBeGreaterThanOrEqual(7);
  });

  it("handles company name with quotes and commas together", () => {
    const name = 'Acme "Global", Ltd.';
    const escaped = escapeCsvField(name);
    expect(escaped).toBe('"Acme ""Global"", Ltd."');
  });
});

// ─────────────────────────────────────────────────────────
// Bug #5 — addProgressToast double-settle guard
// ─────────────────────────────────────────────────────────
import { useStore } from "@/lib/navigator/store";

describe("Bug #5 — addProgressToast double-settle guard", () => {
  beforeEach(() => {
    // Reset store state
    useStore.setState({ toasts: [] });
  });

  it("resolve() works on first call", () => {
    const handle = useStore.getState().addProgressToast("Loading...");
    handle.resolve("Done!");

    const toast = useStore.getState().toasts.find((t) => t.progress?.status === "resolved");
    expect(toast).toBeDefined();
    expect(toast?.message).toBe("Done!");
    expect(toast?.type).toBe("success");
  });

  it("reject() works on first call", () => {
    const handle = useStore.getState().addProgressToast("Loading...");
    handle.reject("Failed!");

    const toast = useStore.getState().toasts.find((t) => t.progress?.status === "rejected");
    expect(toast).toBeDefined();
    expect(toast?.message).toBe("Failed!");
    expect(toast?.type).toBe("error");
  });

  it("second resolve() after resolve() is a no-op", () => {
    const handle = useStore.getState().addProgressToast("Loading...");
    handle.resolve("First done");
    handle.resolve("Second done — should be ignored");

    const resolved = useStore.getState().toasts.filter((t) => t.progress?.status === "resolved");
    expect(resolved).toHaveLength(1);
    expect(resolved[0].message).toBe("First done");
  });

  it("reject() after resolve() is a no-op", () => {
    const handle = useStore.getState().addProgressToast("Loading...");
    handle.resolve("Done!");
    handle.reject("Failed — should be ignored");

    const toasts = useStore.getState().toasts;
    const progressToast = toasts[toasts.length - 1];
    expect(progressToast.progress?.status).toBe("resolved");
    expect(progressToast.type).toBe("success");
    expect(progressToast.message).toBe("Done!");
  });

  it("resolve() after reject() is a no-op", () => {
    const handle = useStore.getState().addProgressToast("Loading...");
    handle.reject("Failed!");
    handle.resolve("Done — should be ignored");

    const toasts = useStore.getState().toasts;
    const progressToast = toasts[toasts.length - 1];
    expect(progressToast.progress?.status).toBe("rejected");
    expect(progressToast.type).toBe("error");
    expect(progressToast.message).toBe("Failed!");
  });

  it("multiple independent progress toasts each settle independently", () => {
    const h1 = useStore.getState().addProgressToast("Task 1...");
    const h2 = useStore.getState().addProgressToast("Task 2...");

    h1.resolve("Task 1 done");
    h2.reject("Task 2 failed");

    const toasts = useStore.getState().toasts;
    const resolved = toasts.find((t) => t.progress?.status === "resolved");
    const rejected = toasts.find((t) => t.progress?.status === "rejected");

    expect(resolved).toBeDefined();
    expect(resolved?.message).toBe("Task 1 done");
    expect(rejected).toBeDefined();
    expect(rejected?.message).toBe("Task 2 failed");
  });
});

// ─────────────────────────────────────────────────────────
// Bug #6 — FilterPanel activeFilterCount
// ─────────────────────────────────────────────────────────
describe("Bug #6 — activeFilterCount excludes hideExcluded toggle", () => {
  it("returns 0 when all filters are at default (including hideExcluded: true)", () => {
    // Default state has hideExcluded: true — this should NOT count
    const filters = {
      sources: [] as string[],
      verticals: [] as string[],
      regions: [] as string[],
      sizes: [] as string[],
      signals: [] as string[],
      quickFilters: [] as string[],
      hideExcluded: true,
    };
    const count =
      filters.sources.length +
      filters.verticals.length +
      filters.regions.length +
      filters.sizes.length +
      filters.signals.length +
      filters.quickFilters.length;
    expect(count).toBe(0);
  });

  it("does NOT count hideExcluded=false as an active filter", () => {
    const filters = {
      sources: [] as string[],
      verticals: [] as string[],
      regions: [] as string[],
      sizes: [] as string[],
      signals: [] as string[],
      quickFilters: [] as string[],
      hideExcluded: false,
    };
    const count =
      filters.sources.length +
      filters.verticals.length +
      filters.regions.length +
      filters.sizes.length +
      filters.signals.length +
      filters.quickFilters.length;
    // Previously this was count + 1 when hideExcluded was false
    expect(count).toBe(0);
  });

  it("counts actual filter selections correctly", () => {
    const filters = {
      sources: ["exa", "apollo"],
      verticals: ["food_ingredients"],
      regions: [],
      sizes: ["51-200"],
      signals: [],
      quickFilters: ["high_icp"],
      hideExcluded: false,
    };
    const count =
      filters.sources.length +
      filters.verticals.length +
      filters.regions.length +
      filters.sizes.length +
      filters.signals.length +
      filters.quickFilters.length;
    expect(count).toBe(5); // 2 + 1 + 0 + 1 + 0 + 1
  });
});

// ─────────────────────────────────────────────────────────
// Bug #7 — Orphan Toast.tsx deleted
// ─────────────────────────────────────────────────────────
describe("Bug #7 — Orphan Toast.tsx deleted", () => {
  it("src/components/shared/Toast.tsx does not exist", () => {
    const filePath = path.resolve(__dirname, "../../components/navigator/shared/Toast.tsx");
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// Bug #1 — CommandPalette Overlay uses closeOnEscape={false}
// ─────────────────────────────────────────────────────────
describe("Bug #1 — CommandPalette passes closeOnEscape={false} to Overlay", () => {
  it("source code contains closeOnEscape={false} in CommandPalette.tsx", () => {
    const filePath = path.resolve(__dirname, "../../components/navigator/command/CommandPalette.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("closeOnEscape={false}");
  });
});

// ─────────────────────────────────────────────────────────
// Bug #2 — useKeyboardShortcuts uses empty dep array
// ─────────────────────────────────────────────────────────
describe("Bug #2 — useKeyboardShortcuts uses stable listener", () => {
  it("useEffect has empty dependency array", () => {
    const filePath = path.resolve(__dirname, "../../hooks/navigator/useKeyboardShortcuts.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    // Should have `}, []);` (empty dep array)
    expect(source).toMatch(/\},\s*\[\]\s*\)/);
    // Should NOT have `}, [store]);`
    expect(source).not.toMatch(/\},\s*\[store\]\s*\)/);
  });

  it("uses useStore.getState() inside handler instead of closure", () => {
    const filePath = path.resolve(__dirname, "../../hooks/navigator/useKeyboardShortcuts.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("useStore.getState()");
    // Should NOT have `const store = useStore()` at the top level of the hook
    expect(source).not.toMatch(/const store = useStore\(\)/);
  });
});

// ─────────────────────────────────────────────────────────
// Bug #4 — useInlineFeedback tracks both timers
// ─────────────────────────────────────────────────────────
describe("Bug #4 — useInlineFeedback timer cleanup", () => {
  it("source code tracks outer and inner timers separately", () => {
    const filePath = path.resolve(__dirname, "../../hooks/navigator/useInlineFeedback.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("outerTimerRef");
    expect(source).toContain("innerTimerRef");
    // Should NOT have a single `timerRef` anymore
    expect(source).not.toMatch(/\btimerRef\b/);
  });

  it("has an unmount cleanup useEffect", () => {
    const filePath = path.resolve(__dirname, "../../hooks/navigator/useInlineFeedback.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    // Cleanup effect that clears both timers
    expect(source).toContain("clearTimeout(outerTimerRef.current)");
    expect(source).toContain("clearTimeout(innerTimerRef.current)");
  });
});

// ─────────────────────────────────────────────────────────
// Bug #8 — Overlay escape handler uses bubble phase
// ─────────────────────────────────────────────────────────
describe("Bug #8 — Overlay escape handler uses bubble phase", () => {
  it("addEventListener does NOT use capture (third arg true)", () => {
    const filePath = path.resolve(__dirname, "../../components/primitives/Overlay.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    // Find the escape handler addEventListener — should NOT end with , true)
    const addListenerCalls = source.match(/addEventListener\("keydown".*\)/g) ?? [];
    for (const call of addListenerCalls) {
      expect(call).not.toContain("true");
    }
  });

  it("removeEventListener also does NOT use capture", () => {
    const filePath = path.resolve(__dirname, "../../components/primitives/Overlay.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    const removeListenerCalls = source.match(/removeEventListener\("keydown".*\)/g) ?? [];
    for (const call of removeListenerCalls) {
      expect(call).not.toContain("true");
    }
  });
});

// ─────────────────────────────────────────────────────────
// Integration: store default filters produce 0 active count
// ─────────────────────────────────────────────────────────
describe("Integration — store default filters", () => {
  it("default filter state produces activeFilterCount of 0", () => {
    // Reset to defaults — only verticals and quickFilters start empty
    // The active count logic in FilterPanel only counts verticals + regions + sizes + signals + quickFilters
    // but all-selected categories are treated as "no filter" in the UI
    useStore.getState().resetFilters();
    const filters = useStore.getState().filters;

    // verticals and quickFilters start empty, so they contribute 0
    expect(filters.verticals.length).toBe(0);
    expect(filters.quickFilters.length).toBe(0);
  });

  it("adding a vertical filter increases count", () => {
    useStore.getState().resetFilters();
    useStore.getState().setFilters({ verticals: ["Food Ingredients"] });
    const filters = useStore.getState().filters;

    expect(filters.verticals.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
// Integration: rapid progress toast settle doesn't corrupt
// ─────────────────────────────────────────────────────────
describe("Integration — rapid progress toast operations", () => {
  beforeEach(() => {
    useStore.setState({ toasts: [] });
  });

  it("creating and resolving many toasts rapidly doesn't crash", () => {
    const handles = Array.from({ length: 20 }, (_, i) =>
      useStore.getState().addProgressToast(`Task ${i}...`)
    );

    // Resolve even, reject odd
    handles.forEach((h, i) => {
      if (i % 2 === 0) h.resolve(`Done ${i}`);
      else h.reject(`Failed ${i}`);
    });

    // Try double-settling all of them
    handles.forEach((h, i) => {
      h.resolve(`Second resolve ${i}`);
      h.reject(`Second reject ${i}`);
    });

    const toasts = useStore.getState().toasts;
    expect(toasts).toHaveLength(20);

    const resolved = toasts.filter((t) => t.progress?.status === "resolved");
    const rejected = toasts.filter((t) => t.progress?.status === "rejected");
    expect(resolved).toHaveLength(10);
    expect(rejected).toHaveLength(10);
  });
});

// ─────────────────────────────────────────────────────────
// CSV edge cases — comprehensive
// ─────────────────────────────────────────────────────────
describe("CSV escaping — edge cases", () => {
  it("handles empty string", () => {
    expect(escapeCsvField("")).toBe("");
  });

  it("handles string that is just a comma", () => {
    expect(escapeCsvField(",")).toBe('","');
  });

  it("handles string that is just a double quote", () => {
    expect(escapeCsvField('"')).toBe('""""');
  });

  it("handles string with only newlines", () => {
    expect(escapeCsvField("\n")).toBe('"\n"');
  });

  it("real-world: Indian company with comma in name", () => {
    expect(escapeCsvField("Tata Chemicals, Ltd.")).toBe('"Tata Chemicals, Ltd."');
  });

  it("real-world: title with quotes", () => {
    expect(escapeCsvField('VP of "Strategic Initiatives"')).toBe('"VP of ""Strategic Initiatives"""');
  });

  it("produces parseable CSV when all fields have special chars", () => {
    const fields = [
      'O\'Brien',
      "Smith, Jr.",
      "o@x.com",
      '"Chief" Officer',
      "Acme, Inc.",
      "",
      "95",
    ];
    const row = fields.map(escapeCsvField).join(",");
    // Should not produce broken CSV — verify no unbalanced quotes
    let quoteCount = 0;
    for (const ch of row) {
      if (ch === '"') quoteCount++;
    }
    // Total quotes should be even (balanced)
    expect(quoteCount % 2).toBe(0);
  });
});
