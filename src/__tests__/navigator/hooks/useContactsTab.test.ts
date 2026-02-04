import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock store — use vi.hoisted to avoid hoisting issues with vi.mock factory
// ---------------------------------------------------------------------------

const { mockSetContactsForDomain } = vi.hoisted(() => ({
  mockSetContactsForDomain: vi.fn(),
}));

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    viewMode: "contacts",
    searchResults: [
      { domain: "fail.com", name: "FailCo", contactCount: 5, icpScore: 50, sources: [], signals: [], employeeCount: 10, hqLocation: "", description: "", websiteUrl: "", linkedinUrl: "", industry: "", vertical: "", hubspotStatus: "none", freshsalesStatus: "none", lastRefreshedAt: null },
    ],
    contactsByDomain: {} as Record<string, unknown[]>,
    setContactsForDomain: mockSetContactsForDomain,
    contactFilters: { seniority: [], hasEmail: false, sources: [], sortBy: "seniority" },
    contactGroupsCollapsed: {},
    filteredCompanies: () => [
      { domain: "fail.com", name: "FailCo", icpScore: 50, sources: [], signals: [], employeeCount: 10 },
    ],
    exclusions: [],
  }));
  return { useStore: store };
});

vi.mock("@/lib/utils", () => ({
  pLimit: () => {
    return <T,>(fn: () => Promise<T>) => fn();
  },
}));

import { useContactsTab } from "@/hooks/navigator/useContactsTab";

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------

describe("useContactsTab — failedDomains tracking", () => {
  it("failedDomains tracks domains where fetch failed", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useContactsTab());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.failedDomains.has("fail.com")).toBe(true);
  });

  it("retryDomain re-fetches a previously failed domain", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() => useContactsTab());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.failedDomains.has("fail.com")).toBe(true);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contacts: [{ id: "c1", firstName: "Jane" }] }),
    });

    await act(async () => {
      result.current.retryDomain("fail.com");
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.failedDomains.has("fail.com")).toBe(false);
    expect(mockSetContactsForDomain).toHaveBeenCalledWith("fail.com", [{ id: "c1", firstName: "Jane" }]);
  });
});
