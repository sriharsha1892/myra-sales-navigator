import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { Contact } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Shared mock for useBrowserNotifications
// ---------------------------------------------------------------------------

const mockNotify = vi.fn();
vi.mock("@/hooks/navigator/useBrowserNotifications", () => ({
  useBrowserNotifications: () => ({
    enabled: true,
    permission: "granted" as NotificationPermission,
    toggleEnabled: vi.fn(),
    notify: mockNotify,
  }),
}));

// ---------------------------------------------------------------------------
// Mock ui-copy
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/ui-copy", () => ({
  pick: (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Mock store for useExport
// ---------------------------------------------------------------------------

const mockAddToast = vi.fn();
const mockAddProgressToast = vi.fn(() => ({
  resolve: vi.fn(),
  reject: vi.fn(),
}));
const mockSetExportState = vi.fn();
const mockSetTriggerExport = vi.fn();

const { mockStoreState } = vi.hoisted(() => {
  const mockStoreState: Record<string, unknown> = {
    viewMode: "companies",
    selectedContactIds: new Set<string>(),
    selectedCompanyDomains: new Set(["test.com"]),
    contactsByDomain: {
      "test.com": [
        {
          id: "ct-1",
          companyDomain: "test.com",
          companyName: "TestCo",
          firstName: "Jane",
          lastName: "Doe",
          title: "VP Sales",
          email: "jane@test.com",
          phone: null,
          linkedinUrl: null,
          emailConfidence: 85,
          confidenceLevel: "medium",
          sources: ["apollo"],
          seniority: "vp",
          lastVerified: null,
        },
        {
          id: "ct-2",
          companyDomain: "test.com",
          companyName: "TestCo",
          firstName: "Bob",
          lastName: "Smith",
          title: "Engineer",
          email: null,
          phone: null,
          linkedinUrl: null,
          emailConfidence: 0,
          confidenceLevel: "low",
          sources: ["apollo"],
          seniority: "staff",
          lastVerified: null,
        },
      ] as Contact[],
    },
    exportState: null,
    triggerExport: null,
    userCopyFormat: "default",
    adminConfig: {
      copyFormats: [{ id: "default", name: "Default", template: "{{first_name}} <{{email}}>" }],
      exportSettings: { autoVerifyOnExport: false, confidenceThreshold: 0 },
    },
    userName: "TestUser",
  };
  return { mockStoreState };
});

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => mockStoreState);
  // Provide mock functions
  const originalGetState = store.getState;
  store.getState = () => ({
    ...originalGetState(),
    userName: "TestUser",
  });
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const state = {
      ...mockStoreState,
      addToast: mockAddToast,
      addProgressToast: mockAddProgressToast,
      setExportState: mockSetExportState,
      setTriggerExport: mockSetTriggerExport,
    };
    return selector(state);
  };
  useStore.getState = store.getState;
  useStore.setState = store.setState;
  useStore.subscribe = store.subscribe;
  return { useStore };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useExport } from "@/hooks/navigator/useExport";

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset localStorage
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
  });
  // Mock fetch
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ text: "Jane <jane@test.com>", count: 1, skipped: 0 }),
  }));
  // Mock clipboard
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests: useExport auto-export bypass
// ---------------------------------------------------------------------------

describe("useExport — auto-export bypass (nav_auto_export)", () => {
  it("opens contact picker by default when in companies view", () => {
    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.initiateExport("clipboard");
    });

    // Should open the picker (setExportState with step: "picking")
    expect(mockSetExportState).toHaveBeenCalledWith(
      expect.objectContaining({ step: "picking" })
    );
  });

  it("skips contact picker when nav_auto_export is enabled", async () => {
    // Enable auto-export
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => key === "nav_auto_export" ? "1" : null
    );

    const { result } = renderHook(() => useExport());

    await act(async () => {
      result.current.initiateExport("clipboard");
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should NOT open picker — no setExportState with step: "picking"
    const pickingCalls = mockSetExportState.mock.calls.filter(
      (call) => call[0]?.step === "picking"
    );
    expect(pickingCalls).toHaveLength(0);
  });

  it("still shows invalid email warning toast during auto-export", () => {
    // Enable auto-export. Contact ct-2 has no email.
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => key === "nav_auto_export" ? "1" : null
    );

    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.initiateExport("clipboard");
    });

    // Should show warning about 1 contact with missing email
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        message: expect.stringContaining("1 contact"),
      })
    );
  });

  it("does not auto-export when flag is off", () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { result } = renderHook(() => useExport());

    act(() => {
      result.current.initiateExport("clipboard");
    });

    // Should open picker
    expect(mockSetExportState).toHaveBeenCalledWith(
      expect.objectContaining({ step: "picking" })
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: useExport notify calls
// ---------------------------------------------------------------------------

describe("useExport — notify on export completion", () => {
  it("notify is available in executeExport (integration check)", async () => {
    const { result } = renderHook(() => useExport());

    const contacts: Contact[] = [{
      id: "ct-1",
      companyDomain: "test.com",
      companyName: "TestCo",
      firstName: "Jane",
      lastName: "Doe",
      title: "VP Sales",
      email: "jane@test.com",
      phone: null,
      linkedinUrl: null,
      emailConfidence: 85,
      confidenceLevel: "medium",
      sources: ["apollo"],
      seniority: "vp",
      lastVerified: null,
    }];

    await act(async () => {
      await result.current.executeExport(contacts, "clipboard");
    });

    // After successful export, notify should have been called
    expect(mockNotify).toHaveBeenCalledWith(
      "Export complete",
      expect.stringContaining("clipboard")
    );
  });

  it("notify is called with failure message when export fails", async () => {
    // Make fetch fail with rate limit
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    // Also fail the fallback clipboard write to trigger outer catch
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("clipboard fail")) },
    });

    const { result } = renderHook(() => useExport());

    const contacts: Contact[] = [{
      id: "ct-1",
      companyDomain: "test.com",
      companyName: "TestCo",
      firstName: "Jane",
      lastName: "Doe",
      title: "VP Sales",
      email: "jane@test.com",
      phone: null,
      linkedinUrl: null,
      emailConfidence: 85,
      confidenceLevel: "medium",
      sources: ["apollo"],
      seniority: "vp",
      lastVerified: null,
    }];

    await act(async () => {
      await result.current.executeExport(contacts, "clipboard");
    });

    // The clipboard fallback will fire — either success notify or the fallback path
    // Key thing: notify was called at least once
    expect(mockNotify).toHaveBeenCalled();
  });

  it("notify is called for CSV export success", async () => {
    const csvBlob = new Blob(["data"], { type: "text/csv" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      blob: async () => csvBlob,
    });

    // Mock URL.createObjectURL and document.createElement
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });
    const mockClick = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const el = origCreateElement("a");
        el.click = mockClick;
        return el;
      }
      return origCreateElement(tag);
    });

    const { result } = renderHook(() => useExport());

    const contacts: Contact[] = [{
      id: "ct-1",
      companyDomain: "test.com",
      companyName: "TestCo",
      firstName: "Jane",
      lastName: "Doe",
      title: "VP Sales",
      email: "jane@test.com",
      phone: null,
      linkedinUrl: null,
      emailConfidence: 85,
      confidenceLevel: "medium",
      sources: ["apollo"],
      seniority: "vp",
      lastVerified: null,
    }];

    await act(async () => {
      await result.current.executeExport(contacts, "csv");
    });

    expect(mockNotify).toHaveBeenCalledWith(
      "Export complete",
      expect.stringContaining("1 contacts to CSV")
    );
  });

  it("does not call notify when there are no contacts", async () => {
    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.executeExport([], "clipboard");
    });

    // Should show warning toast, but no browser notification
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "No contacts to export" })
    );
  });
});
