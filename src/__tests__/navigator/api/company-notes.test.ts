import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CompanyNote } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Mocks — Supabase db helpers
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/db", () => ({
  getNotesForCompany: vi.fn(),
  addNote: vi.fn(),
}));

import { GET, POST } from "@/app/api/company/[domain]/notes/route";
import { getNotesForCompany, addNote } from "@/lib/supabase/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callGET(domain = "acme.com") {
  const request = new NextRequest(
    "http://localhost/api/company/" + domain + "/notes"
  );
  return GET(request, { params: Promise.resolve({ domain }) });
}

async function callPOST(domain: string, body: Record<string, unknown>) {
  const request = new NextRequest(
    "http://localhost/api/company/" + domain + "/notes",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
  return POST(request, { params: Promise.resolve({ domain }) });
}

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe("GET /api/company/[domain]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notes array from getNotesForCompany", async () => {
    const mockNotes: CompanyNote[] = [
      { id: "n1", content: "Great lead", authorName: "Adi", companyDomain: "acme.com", createdAt: "2026-01-28", updatedAt: "2026-01-28", mentions: [] },
      { id: "n2", content: "Followed up", authorName: "Satish", companyDomain: "acme.com", createdAt: "2026-01-29", updatedAt: "2026-01-29", mentions: [] },
    ];
    vi.mocked(getNotesForCompany).mockResolvedValue(mockNotes);

    const res = await callGET("acme.com");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notes).toEqual(mockNotes);
    expect(getNotesForCompany).toHaveBeenCalledWith("acme.com");
  });

  it("returns 500 when getNotesForCompany throws", async () => {
    vi.mocked(getNotesForCompany).mockRejectedValue(
      new Error("Database connection failed")
    );

    const res = await callGET("acme.com");
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal error");
  });
});

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe("POST /api/company/[domain]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a note with valid content and authorName", async () => {
    const mockNote: CompanyNote = {
      id: "n1",
      content: "Promising prospect",
      authorName: "Adi",
      companyDomain: "acme.com",
      createdAt: "2026-01-28",
      updatedAt: null,
      mentions: [],
    };
    vi.mocked(addNote).mockResolvedValue(mockNote);

    const res = await callPOST("acme.com", {
      content: "Promising prospect",
      authorName: "Adi",
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.note).toEqual(mockNote);
    expect(addNote).toHaveBeenCalledWith(
      "acme.com",
      "Promising prospect",
      "Adi",
      []
    );
  });

  it("passes mentions array to addNote when provided", async () => {
    const mockNote: CompanyNote = {
      id: "n2",
      content: "Check with @Satish",
      authorName: "Adi",
      companyDomain: "acme.com",
      createdAt: "2026-01-29",
      updatedAt: null,
      mentions: ["Satish"],
    };
    vi.mocked(addNote).mockResolvedValue(mockNote);

    const res = await callPOST("acme.com", {
      content: "Check with @Satish",
      authorName: "Adi",
      mentions: ["Satish"],
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.note).toEqual(mockNote);
    expect(addNote).toHaveBeenCalledWith(
      "acme.com",
      "Check with @Satish",
      "Adi",
      ["Satish"]
    );
  });

  it("returns 400 when content is missing", async () => {
    const res = await callPOST("acme.com", { authorName: "Adi" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/content and authorName are required/i);
  });

  it("returns 400 when authorName is missing", async () => {
    const res = await callPOST("acme.com", { content: "Some note" });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/content and authorName are required/i);
  });

  it("returns 500 when addNote returns null", async () => {
    vi.mocked(addNote).mockResolvedValue(null);

    const res = await callPOST("acme.com", {
      content: "Some note",
      authorName: "Adi",
    });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/failed to create note/i);
  });
});
