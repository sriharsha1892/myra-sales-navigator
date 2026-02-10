import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock Notification API
// ---------------------------------------------------------------------------

let mockPermission: NotificationPermission = "default";
const mockClose = vi.fn();
const mockRequestPermission = vi.fn().mockResolvedValue("granted");
let lastNotification: { title: string; options?: NotificationOptions; onclick?: (() => void) | null } | null = null;

class MockNotification {
  title: string;
  options?: NotificationOptions;
  onclick: (() => void) | null = null;
  close = mockClose;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastNotification = this;
  }

  static get permission(): NotificationPermission {
    return mockPermission;
  }

  static requestPermission = mockRequestPermission;
}

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPermission = "default";
  lastNotification = null;
  vi.clearAllMocks();

  // Stub Notification global
  vi.stubGlobal("Notification", MockNotification);

  // Stub localStorage
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
  });

  // Tab visible by default
  Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useBrowserNotifications", () => {
  describe("initial state", () => {
    it("returns enabled=false when localStorage has no flag", () => {
      const { result } = renderHook(() => useBrowserNotifications());
      expect(result.current.enabled).toBe(false);
    });

    it("returns enabled=true when localStorage flag is set", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("1");
      const { result } = renderHook(() => useBrowserNotifications());
      expect(result.current.enabled).toBe(true);
    });

    it("returns current permission state", () => {
      mockPermission = "granted";
      const { result } = renderHook(() => useBrowserNotifications());
      expect(result.current.permission).toBe("granted");
    });

    it("returns denied when Notification API not available", () => {
      // Must delete — setting to undefined still leaves key in `window`.
      // `delete` on a typed global requires `as any` since TS doesn't allow
      // deleting non-optional properties from typed objects.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).Notification;
      const { result } = renderHook(() => useBrowserNotifications());
      expect(result.current.permission).toBe("denied");
    });
  });

  describe("toggleEnabled", () => {
    it("sets localStorage flag to 1 when enabling", async () => {
      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.toggleEnabled(true);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith("nav_notifications_enabled", "1");
    });

    it("removes localStorage flag when disabling", async () => {
      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.toggleEnabled(false);
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith("nav_notifications_enabled");
    });

    it("requests permission on first enable when permission is default", async () => {
      mockPermission = "default";
      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.toggleEnabled(true);
      });

      expect(mockRequestPermission).toHaveBeenCalledOnce();
    });

    it("does not request permission when already granted", async () => {
      mockPermission = "granted";
      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.toggleEnabled(true);
      });

      expect(mockRequestPermission).not.toHaveBeenCalled();
    });

    it("does not request permission when already denied", async () => {
      mockPermission = "denied";
      const { result } = renderHook(() => useBrowserNotifications());

      await act(async () => {
        await result.current.toggleEnabled(true);
      });

      expect(mockRequestPermission).not.toHaveBeenCalled();
    });
  });

  describe("notify", () => {
    it("does not fire when tab is focused (document.hidden = false)", () => {
      mockPermission = "granted";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("1");
      Object.defineProperty(document, "hidden", { value: false, configurable: true });

      const { result } = renderHook(() => useBrowserNotifications());
      result.current.notify("Test", "body");

      expect(lastNotification).toBeNull();
    });

    it("does not fire when disabled (flag not set)", () => {
      mockPermission = "granted";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      Object.defineProperty(document, "hidden", { value: true, configurable: true });

      const { result } = renderHook(() => useBrowserNotifications());
      result.current.notify("Test", "body");

      expect(lastNotification).toBeNull();
    });

    it("does not fire when permission is not granted", () => {
      mockPermission = "denied";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("1");
      Object.defineProperty(document, "hidden", { value: true, configurable: true });

      const { result } = renderHook(() => useBrowserNotifications());
      result.current.notify("Test", "body");

      expect(lastNotification).toBeNull();
    });

    it("fires notification when document.hidden + enabled + granted", () => {
      mockPermission = "granted";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("1");
      Object.defineProperty(document, "hidden", { value: true, configurable: true });

      const { result } = renderHook(() => useBrowserNotifications());
      result.current.notify("Search complete", "Found 25 companies");

      expect(lastNotification).not.toBeNull();
      expect(lastNotification!.title).toBe("Search complete");
      expect(lastNotification!.options?.body).toBe("Found 25 companies");
      expect(lastNotification!.options?.icon).toBe("/favicon.ico");
    });

    it("auto-closes after 5 seconds", () => {
      vi.useFakeTimers();
      mockPermission = "granted";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("1");
      Object.defineProperty(document, "hidden", { value: true, configurable: true });

      const { result } = renderHook(() => useBrowserNotifications());
      result.current.notify("Test");

      expect(mockClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(mockClose).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });

    it("click handler focuses window and closes notification", () => {
      mockPermission = "granted";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("1");
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      const mockFocus = vi.fn();
      vi.stubGlobal("focus", mockFocus);

      const { result } = renderHook(() => useBrowserNotifications());
      result.current.notify("Test");

      expect(lastNotification).not.toBeNull();
      // Simulate click
      (lastNotification as unknown as { onclick: () => void }).onclick();

      expect(mockFocus).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });

    it("fires with only title (body optional)", () => {
      mockPermission = "granted";
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("1");
      Object.defineProperty(document, "hidden", { value: true, configurable: true });

      const { result } = renderHook(() => useBrowserNotifications());
      result.current.notify("Done");

      expect(lastNotification).not.toBeNull();
      expect(lastNotification!.title).toBe("Done");
      expect(lastNotification!.options?.body).toBeUndefined();
    });
  });
});
