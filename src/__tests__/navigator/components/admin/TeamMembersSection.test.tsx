import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { TeamMember, AdminConfig, FreshsalesSettings, IcpWeights, AuthSettings } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock store — vi.mock is hoisted, all values must be inline
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/store", async () => {
  const { create } = await import("zustand");
  const store = create(() => ({
    adminConfig: {
      teamMembers: [
        { name: "Adi", email: "adi@ask-myra.ai", isAdmin: true },
        { name: "JVS", email: "jvs@ask-myra.ai", isAdmin: true },
        { name: "Satish", email: "satish@ask-myra.ai", isAdmin: false },
        { name: "Nikita", email: "nikita@ask-myra.ai", isAdmin: false },
      ],
      freshsalesSettings: {},
      icpWeights: {},
      authSettings: null,
      authRequests: [],
    },
    updateAdminConfig: vi.fn(),
    addToast: vi.fn(),
    addUndoToast: vi.fn(),
  }));
  return { useStore: store };
});

import { useStore } from "@/lib/navigator/store";

// ---------------------------------------------------------------------------
// Defaults for use in beforeEach (NOT inside vi.mock)
// ---------------------------------------------------------------------------

const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  { name: "Adi", email: "adi@ask-myra.ai", isAdmin: true },
  { name: "JVS", email: "jvs@ask-myra.ai", isAdmin: true },
  { name: "Satish", email: "satish@ask-myra.ai", isAdmin: false },
  { name: "Nikita", email: "nikita@ask-myra.ai", isAdmin: false },
];

// ---------------------------------------------------------------------------
// Lazy import
// ---------------------------------------------------------------------------

async function importComponent() {
  const mod = await import(
    "@/components/navigator/admin/TeamMembersSection"
  );
  return mod.TeamMembersSection;
}

function setMembers(members: TeamMember[]) {
  const current = useStore.getState() as unknown as Record<string, unknown>;
  const adminConfig = current.adminConfig as Record<string, unknown>;
  useStore.setState({
    adminConfig: {
      ...adminConfig,
      teamMembers: members,
    } as unknown as AdminConfig,
  });
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    adminConfig: {
      teamMembers: DEFAULT_TEAM_MEMBERS.map((m) => ({ ...m })),
      freshsalesSettings: {} as unknown as FreshsalesSettings,
      icpWeights: {} as unknown as IcpWeights,
      authSettings: null as unknown as AuthSettings,
      authRequests: [],
    } as unknown as AdminConfig,
    updateAdminConfig: vi.fn(),
    addToast: vi.fn(),
    addUndoToast: vi.fn(),
  });

  // Mock clipboard and fetch
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://example.com/login/abc",
        expiresIn: "60 minutes",
        links: [],
      }),
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TeamMembersSection", () => {
  // -----------------------------------------------------------------------
  // 1. Renders list of team members
  // -----------------------------------------------------------------------

  it("renders all team member names and emails", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("Adi")).toBeInTheDocument();
    expect(screen.getByText("adi@ask-myra.ai")).toBeInTheDocument();
    expect(screen.getByText("JVS")).toBeInTheDocument();
    expect(screen.getByText("jvs@ask-myra.ai")).toBeInTheDocument();
    expect(screen.getByText("Satish")).toBeInTheDocument();
    expect(screen.getByText("satish@ask-myra.ai")).toBeInTheDocument();
    expect(screen.getByText("Nikita")).toBeInTheDocument();
    expect(screen.getByText("nikita@ask-myra.ai")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Shows member count
  // -----------------------------------------------------------------------

  it("shows total member count", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("4 members")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 3. Admin checkbox reflects admin status
  // -----------------------------------------------------------------------

  it("admin checkboxes reflect isAdmin status", async () => {
    const Component = await importComponent();
    render(<Component />);

    const adminCheckboxes = screen.getAllByRole("checkbox");
    // 4 members = 4 admin checkboxes
    expect(adminCheckboxes[0]).toBeChecked(); // Adi
    expect(adminCheckboxes[1]).toBeChecked(); // JVS
    expect(adminCheckboxes[2]).not.toBeChecked(); // Satish
    expect(adminCheckboxes[3]).not.toBeChecked(); // Nikita
  });

  // -----------------------------------------------------------------------
  // 4. Toggle admin status
  // -----------------------------------------------------------------------

  it("toggling admin checkbox calls updateAdminConfig", async () => {
    const Component = await importComponent();
    render(<Component />);

    // Toggle Satish to admin
    const adminCheckboxes = screen.getAllByRole("checkbox");
    fireEvent.click(adminCheckboxes[2]); // Satish's checkbox

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        teamMembers: expect.arrayContaining([
          expect.objectContaining({
            name: "Satish",
            isAdmin: true,
          }),
        ]),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 5. Add member form
  // -----------------------------------------------------------------------

  it("add member form has name input, email input, and Add button", async () => {
    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("adding a new member calls updateAdminConfig with new member appended", async () => {
    const Component = await importComponent();
    render(<Component />);

    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email");
    const addBtn = screen.getByText("Add");

    fireEvent.change(nameInput, { target: { value: "NewPerson" } });
    fireEvent.change(emailInput, { target: { value: "newperson@test.com" } });
    fireEvent.click(addBtn);

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        teamMembers: expect.arrayContaining([
          expect.objectContaining({
            name: "NewPerson",
            email: "newperson@test.com",
            isAdmin: false,
          }),
        ]),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 6. Remove member button
  // -----------------------------------------------------------------------

  it("remove button calls updateAdminConfig with member removed", async () => {
    const Component = await importComponent();
    render(<Component />);

    const removeButtons = screen.getAllByText("Remove");
    expect(removeButtons).toHaveLength(4);

    // Click remove on Nikita (last one)
    fireEvent.click(removeButtons[3]);

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        teamMembers: expect.not.arrayContaining([
          expect.objectContaining({ name: "Nikita" }),
        ]),
      })
    );

    // Should also trigger undo toast
    const undoFn = useStore.getState().addUndoToast as ReturnType<typeof vi.fn>;
    expect(undoFn).toHaveBeenCalledWith(
      "Removed Nikita",
      expect.any(Function)
    );
  });

  // -----------------------------------------------------------------------
  // 7. Empty state
  // -----------------------------------------------------------------------

  it("renders 0 members text when team is empty", async () => {
    setMembers([]);

    const Component = await importComponent();
    render(<Component />);

    expect(screen.getByText("0 members")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 8. Login link button
  // -----------------------------------------------------------------------

  it("each member has a Login link button", async () => {
    const Component = await importComponent();
    render(<Component />);

    const linkButtons = screen.getAllByText("Login link");
    expect(linkButtons).toHaveLength(4);
  });

  it("clicking Login link calls magic-link API and copies to clipboard", async () => {
    const Component = await importComponent();
    render(<Component />);

    const linkButtons = screen.getAllByText("Login link");
    fireEvent.click(linkButtons[0]); // Adi's login link

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/magic-link", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("adi@ask-myra.ai"),
      }));
    });

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://example.com/login/abc"
      );
    });
  });

  // -----------------------------------------------------------------------
  // 9. Generate all links button
  // -----------------------------------------------------------------------

  it("Generate all links button calls magic-link API with all emails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        links: DEFAULT_TEAM_MEMBERS.map((m) => ({
          name: m.name,
          url: `https://example.com/login/${m.name}`,
          expiresIn: "60 minutes",
        })),
      }),
    } as Response);

    const Component = await importComponent();
    render(<Component />);

    const generateAllBtn = screen.getByText("Generate all links");
    fireEvent.click(generateAllBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/magic-link", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("emails"),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // 10. Enter key in email input triggers add
  // -----------------------------------------------------------------------

  it("pressing Enter in email input triggers add", async () => {
    const Component = await importComponent();
    render(<Component />);

    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email");

    fireEvent.change(nameInput, { target: { value: "EnterUser" } });
    fireEvent.change(emailInput, { target: { value: "enter@test.com" } });
    fireEvent.keyDown(emailInput, { key: "Enter" });

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        teamMembers: expect.arrayContaining([
          expect.objectContaining({
            name: "EnterUser",
            email: "enter@test.com",
          }),
        ]),
      })
    );
  });

  // -----------------------------------------------------------------------
  // 11. Shows "Never" for members without lastLoginAt
  // -----------------------------------------------------------------------

  it("shows 'Never' badge for members without lastLoginAt", async () => {
    const Component = await importComponent();
    render(<Component />);

    const neverBadges = screen.getAllByText("Never");
    expect(neverBadges.length).toBe(4);
  });

  // -----------------------------------------------------------------------
  // 12. Does not add duplicate member
  // -----------------------------------------------------------------------

  it("does not add member with duplicate name", async () => {
    const Component = await importComponent();
    render(<Component />);

    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email");
    const addBtn = screen.getByText("Add");

    fireEvent.change(nameInput, { target: { value: "Adi" } });
    fireEvent.change(emailInput, { target: { value: "adi-dup@test.com" } });
    fireEvent.click(addBtn);

    const mockFn = useStore.getState().updateAdminConfig as ReturnType<typeof vi.fn>;
    expect(mockFn).not.toHaveBeenCalled();
  });
});
