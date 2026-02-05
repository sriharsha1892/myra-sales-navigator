import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock useBrowserNotifications
// ---------------------------------------------------------------------------

const mockToggleEnabled = vi.fn();
let mockNotifEnabled = false;
let mockNotifPermission: NotificationPermission = "default";

vi.mock("@/hooks/navigator/useBrowserNotifications", () => ({
  useBrowserNotifications: () => ({
    enabled: mockNotifEnabled,
    permission: mockNotifPermission,
    toggleEnabled: mockToggleEnabled,
    notify: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock AuthProvider
// ---------------------------------------------------------------------------

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    userName: "Satish",
    isAdmin: false,
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockSetViewMode = vi.fn();
const mockSetSortField = vi.fn();
const mockSetUserCopyFormat = vi.fn();

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({}));
  const useStore = (selector: (s: Record<string, unknown>) => unknown) => {
    const mockState: Record<string, unknown> = {
      adminConfig: {
        copyFormats: [
          { id: "default", name: "Name + Email", template: "{{first_name}} {{last_name}} <{{email}}>" },
        ],
        exportSettings: {},
      },
      viewMode: "companies",
      setViewMode: mockSetViewMode,
      sortField: "icp_score",
      setSortField: mockSetSortField,
      userCopyFormat: "default",
      setUserCopyFormat: mockSetUserCopyFormat,
    };
    return selector(mockState);
  };
  useStore.getState = store.getState;
  useStore.setState = store.setState;
  useStore.subscribe = store.subscribe;
  return { useStore };
});

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

let lsStore: Record<string, string> = {};

beforeEach(() => {
  lsStore = {};
  vi.clearAllMocks();
  mockNotifEnabled = false;
  mockNotifPermission = "default";

  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => lsStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { lsStore[key] = val; }),
    removeItem: vi.fn((key: string) => { delete lsStore[key]; }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import SettingsPage from "@/app/(navigator)/settings/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsPage — Notifications section", () => {
  it("renders the Notifications section heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders the Browser Notifications checkbox", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Browser Notifications")).toBeInTheDocument();
  });

  it("checkbox reflects enabled state (unchecked)", () => {
    mockNotifEnabled = false;
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    // The notifications checkbox is the first one after the defaults section
    const notifCheckbox = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Browser Notifications");
    });
    expect(notifCheckbox).not.toBeChecked();
  });

  it("checkbox reflects enabled state (checked)", () => {
    mockNotifEnabled = true;
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const notifCheckbox = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Browser Notifications");
    });
    expect(notifCheckbox).toBeChecked();
  });

  it("calls toggleEnabled when checkbox is toggled", () => {
    mockNotifEnabled = false;
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const notifCheckbox = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Browser Notifications");
    })!;

    fireEvent.click(notifCheckbox);
    expect(mockToggleEnabled).toHaveBeenCalledWith(true);
  });

  it("shows blocked hint when permission is denied", () => {
    mockNotifPermission = "denied";
    render(<SettingsPage />);

    expect(screen.getByText(/Notifications are blocked/)).toBeInTheDocument();
  });

  it("shows standard hint when permission is not denied", () => {
    mockNotifPermission = "default";
    render(<SettingsPage />);

    expect(screen.getByText(/Get notified when searches/)).toBeInTheDocument();
  });

  it("checkbox is disabled when permission is denied", () => {
    mockNotifPermission = "denied";
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const notifCheckbox = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Browser Notifications");
    });
    expect(notifCheckbox).toBeDisabled();
  });

  it("checkbox is enabled when permission is default", () => {
    mockNotifPermission = "default";
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const notifCheckbox = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Browser Notifications");
    });
    expect(notifCheckbox).not.toBeDisabled();
  });
});

describe("SettingsPage — Workflow section", () => {
  it("renders the Workflow section heading", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Workflow")).toBeInTheDocument();
  });

  it("renders skip reveal confirmation toggle", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Skip email reveal confirmation")).toBeInTheDocument();
  });

  it("renders auto-export toggle", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Auto-export (skip contact picker)")).toBeInTheDocument();
  });

  it("skip reveal checkbox reads initial value from localStorage", () => {
    lsStore["nav_skip_reveal_confirm"] = "1";
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const skipRevealCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Skip email reveal");
    });
    expect(skipRevealCb).toBeChecked();
  });

  it("auto-export checkbox reads initial value from localStorage", () => {
    lsStore["nav_auto_export"] = "1";
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const autoExportCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Auto-export");
    });
    expect(autoExportCb).toBeChecked();
  });

  it("toggling skip reveal ON writes to localStorage", () => {
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const skipRevealCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Skip email reveal");
    })!;

    fireEvent.click(skipRevealCb);
    expect(localStorage.setItem).toHaveBeenCalledWith("nav_skip_reveal_confirm", "1");
  });

  it("toggling skip reveal OFF removes from localStorage", () => {
    lsStore["nav_skip_reveal_confirm"] = "1";
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const skipRevealCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Skip email reveal");
    })!;

    // Uncheck (it's currently checked because lsStore has the value)
    fireEvent.click(skipRevealCb);
    expect(localStorage.removeItem).toHaveBeenCalledWith("nav_skip_reveal_confirm");
  });

  it("toggling auto-export ON writes to localStorage", () => {
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const autoExportCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Auto-export");
    })!;

    fireEvent.click(autoExportCb);
    expect(localStorage.setItem).toHaveBeenCalledWith("nav_auto_export", "1");
  });

  it("toggling auto-export OFF removes from localStorage", () => {
    lsStore["nav_auto_export"] = "1";
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const autoExportCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Auto-export");
    })!;

    fireEvent.click(autoExportCb);
    expect(localStorage.removeItem).toHaveBeenCalledWith("nav_auto_export");
  });

  it("both checkboxes start unchecked when localStorage is empty", () => {
    render(<SettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    const skipRevealCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Skip email reveal");
    });
    const autoExportCb = checkboxes.find((cb) => {
      const label = cb.closest("label");
      return label?.textContent?.includes("Auto-export");
    });

    expect(skipRevealCb).not.toBeChecked();
    expect(autoExportCb).not.toBeChecked();
  });

  it("shows hint text for skip reveal", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/reveals immediately without a confirmation/)).toBeInTheDocument();
  });

  it("shows hint text for auto-export", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/exports all contacts directly without opening the picker/)).toBeInTheDocument();
  });
});

describe("SettingsPage — section ordering", () => {
  it("renders Notifications before Workflow before Keyboard Shortcuts", () => {
    render(<SettingsPage />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);

    const notifIdx = headingTexts.indexOf("Notifications");
    const workflowIdx = headingTexts.indexOf("Workflow");
    const shortcutsIdx = headingTexts.indexOf("Keyboard Shortcuts");

    expect(notifIdx).toBeGreaterThan(-1);
    expect(workflowIdx).toBeGreaterThan(notifIdx);
    expect(shortcutsIdx).toBeGreaterThan(workflowIdx);
  });
});
