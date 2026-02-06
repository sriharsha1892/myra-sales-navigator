import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStore } from "@/lib/navigator/store";
import { useExport } from "@/hooks/navigator/useExport";
import type { Contact, AdminConfig } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// ---------------------------------------------------------------------------
// Mock clipboard API
// ---------------------------------------------------------------------------
const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: writeTextMock },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    companyDomain: "acme.com",
    companyName: "Acme Corp",
    firstName: "Jane",
    lastName: "Doe",
    title: "VP Sales",
    email: "jane@acme.com",
    phone: null,
    linkedinUrl: null,
    emailConfidence: 80,
    confidenceLevel: "medium",
    sources: ["apollo"],
    seniority: "vp",
    lastVerified: null,
    ...overrides,
  };
}

function seedStore(contacts: Contact[], autoVerify = true, threshold = 0) {
  const state = useStore.getState();

  // Set contacts by domain
  const byDomain: Record<string, Contact[]> = {};
  for (const c of contacts) {
    (byDomain[c.companyDomain] ??= []).push(c);
  }
  useStore.setState({
    contactsByDomain: byDomain,
    viewMode: "companies",
    selectedContactIds: new Set(contacts.map((c) => c.id)),
    userName: "TestUser",
    adminConfig: {
      ...state.adminConfig,
      exportSettings: {
        ...(state.adminConfig as AdminConfig).exportSettings,
        autoVerifyOnExport: autoVerify,
        confidenceThreshold: threshold,
      },
    } as AdminConfig,
  });
}

describe("useExport — verification flow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    writeTextMock.mockClear();
    useStore.setState(useStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Verify step sets exportState.step = "verify"
  // -----------------------------------------------------------------------

  it("sets step to 'verify' when autoVerifyOnExport is enabled", async () => {
    const contacts = [
      makeContact({ id: "c1", email: "a@acme.com" }),
      makeContact({ id: "c2", email: "b@acme.com" }),
    ];
    seedStore(contacts, true);

    // Mock verification endpoint
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { email: "a@acme.com", status: "valid", score: 95 },
          { email: "b@acme.com", status: "valid", score: 90 },
        ],
      }),
    });

    // Mock clipboard export endpoint (fallback)
    fetchMock.mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useExport());

    // Put into picking state (simulating company view export)
    act(() => {
      useStore.setState({ viewMode: "companies", selectedCompanyDomains: new Set(["acme.com"]) });
    });

    // Re-render to get updated state
    const { result: result2 } = renderHook(() => useExport());

    await act(async () => {
      await result2.current.exportPickedContacts(["c1", "c2"]);
    });

    // Verify that the /api/contact/verify endpoint was called
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contact/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ emails: ["a@acme.com", "b@acme.com"] }),
      })
    );
  });

  // -----------------------------------------------------------------------
  // Verify step transitions: picking → verify → export
  // -----------------------------------------------------------------------

  it("transitions through verify step with correct counts", async () => {
    const contacts = [
      makeContact({ id: "c1", email: "a@acme.com" }),
      makeContact({ id: "c2", email: "b@acme.com" }),
      makeContact({ id: "c3", email: null }), // no email, skipped
    ];
    seedStore(contacts, true);

    // Capture export state changes
    const stateSnapshots: Array<{ step: string; verifiedCount: number; totalCount: number } | null> = [];
    useStore.subscribe((state) => {
      if (state.exportState) {
        stateSnapshots.push({
          step: state.exportState.step,
          verifiedCount: state.exportState.verifiedCount,
          totalCount: state.exportState.totalCount,
        });
      }
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { email: "a@acme.com", status: "valid", score: 95 },
          { email: "b@acme.com", status: "invalid", score: 10 },
        ],
      }),
    });

    // Mock the export call (clipboard server-side)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Jane Doe <a@acme.com>", count: 1 }),
    });

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportPickedContacts(["c1", "c2", "c3"]);
    });

    // Verify state went through "verify" step
    const verifySnapshot = stateSnapshots.find((s) => s?.step === "verify");
    expect(verifySnapshot).toBeDefined();
    expect(verifySnapshot!.totalCount).toBe(2); // only emails, not null
    expect(verifySnapshot!.verifiedCount).toBe(0); // starts at 0
  });

  // -----------------------------------------------------------------------
  // Skips verification when autoVerifyOnExport is disabled
  // -----------------------------------------------------------------------

  it("skips verification when autoVerifyOnExport is false", async () => {
    const contacts = [makeContact({ id: "c1", email: "a@acme.com" })];
    seedStore(contacts, false);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Jane Doe <a@acme.com>", count: 1 }),
    });

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportPickedContacts(["c1"]);
    });

    // Should NOT have called verify endpoint
    const verifyCalls = fetchMock.mock.calls.filter(
      (c) => c[0] === "/api/contact/verify"
    );
    expect(verifyCalls).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Verification failure doesn't block export
  // -----------------------------------------------------------------------

  it("proceeds with export when verification fails", async () => {
    const contacts = [makeContact({ id: "c1", email: "a@acme.com" })];
    seedStore(contacts, true);

    // Verification fails
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Service unavailable" }),
    });

    // Export succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Jane Doe <a@acme.com>", count: 1 }),
    });

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportPickedContacts(["c1"]);
    });

    // Export should still have been attempted
    const exportCalls = fetchMock.mock.calls.filter(
      (c) => c[0] === "/api/export/clipboard"
    );
    expect(exportCalls).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Confidence threshold filtering after verification
  // -----------------------------------------------------------------------

  it("filters out contacts below confidence threshold after verification", async () => {
    const contacts = [
      makeContact({ id: "c1", email: "good@acme.com" }),
      makeContact({ id: "c2", email: "bad@acme.com" }),
    ];
    seedStore(contacts, true, 50); // threshold = 50

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { email: "good@acme.com", status: "valid", score: 95 },
          { email: "bad@acme.com", status: "invalid", score: 10 },
        ],
      }),
    });

    // Capture what gets exported
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Jane Doe <good@acme.com>", count: 1 }),
    });

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportPickedContacts(["c1", "c2"]);
    });

    // The clipboard export should have been called — contacts below threshold filtered
    const exportCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/export/clipboard"
    );
    expect(exportCall).toBeDefined();
    const exportBody = JSON.parse(exportCall![1].body);
    // Only the contact with score >= 50 should remain
    expect(exportBody.contacts).toHaveLength(1);
    expect(exportBody.contacts[0].email).toBe("good@acme.com");
  });

  // -----------------------------------------------------------------------
  // Server-side export logging — calls server routes
  // -----------------------------------------------------------------------

  it("calls server clipboard route with userName and companyDomain", async () => {
    const contacts = [makeContact({ id: "c1", email: "a@acme.com" })];
    seedStore(contacts, false);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Jane Doe <a@acme.com>", count: 1 }),
    });

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportPickedContacts(["c1"]);
    });

    const clipboardCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/export/clipboard"
    );
    expect(clipboardCall).toBeDefined();
    const body = JSON.parse(clipboardCall![1].body);
    expect(body.userName).toBe("TestUser");
    expect(body.companyDomain).toBe("acme.com");
  });

  it("calls server CSV route for CSV exports", async () => {
    const contacts = [makeContact({ id: "c1", email: "a@acme.com" })];
    seedStore(contacts, false);
    useStore.setState({
      exportState: {
        step: "picking",
        contactIds: ["c1"],
        verificationResults: new Map(),
        verifiedCount: 0,
        totalCount: 1,
        mode: "csv",
      },
    });

    // Mock URL.createObjectURL / revokeObjectURL used by CSV download
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:test");
    globalThis.URL.revokeObjectURL = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["csv,data"], { type: "text/csv" }),
    });

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportPickedContacts(["c1"]);
    });

    const csvCall = fetchMock.mock.calls.find(
      (c) => c[0] === "/api/export/csv"
    );
    expect(csvCall).toBeDefined();
    const body = JSON.parse(csvCall![1].body);
    expect(body.userName).toBe("TestUser");
    expect(body.companyDomain).toBe("acme.com");
  });

  // -----------------------------------------------------------------------
  // Falls back to client-side when server export fails
  // -----------------------------------------------------------------------

  it("falls back to client-side clipboard when server route fails", async () => {
    const contacts = [makeContact({ id: "c1", email: "a@acme.com" })];
    seedStore(contacts, false);

    // Server route fails
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useExport());

    await act(async () => {
      await result.current.exportPickedContacts(["c1"]);
    });

    // Should have called clipboard.writeText as fallback
    expect(writeTextMock).toHaveBeenCalled();
  });
});
