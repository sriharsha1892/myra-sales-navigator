/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/export/csv/route";

// --- Supabase mock -----------------------------------------------------------

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

function fakeTable(data: unknown = null, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  (chain as Record<string, unknown>).then = (resolve: (v: unknown) => void) =>
    resolve({ data, error });
  return chain;
}

// --- Fixtures ----------------------------------------------------------------

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@acme.com",
    title: "VP Sales",
    companyName: "Acme Corp",
    companyDomain: "acme.com",
    phone: "+1-555-0100",
    linkedinUrl: "https://linkedin.com/in/janedoe",
    seniority: "VP",
    emailConfidence: 92,
    ...overrides,
  };
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/export/csv", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// --- Tests -------------------------------------------------------------------

describe("POST /api/export/csv", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockReturnValue(fakeTable());
  });

  it("returns text/csv Content-Type", async () => {
    const res = await POST(
      makeRequest({ contacts: [makeContact()] })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
  });

  it("returns Content-Disposition with filename", async () => {
    const res = await POST(
      makeRequest({
        contacts: [makeContact()],
        companyDomain: "acme.com",
      })
    );

    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("filename=");
    expect(disposition).toContain("contacts-acme.com");
    expect(disposition).toContain(".csv");
  });

  it("CSV has correct header row", async () => {
    const res = await POST(
      makeRequest({ contacts: [makeContact()] })
    );
    const text = await res.text();
    const headerLine = text.split("\n")[0];

    expect(headerLine).toBe(
      "First Name,Last Name,Email,Title,Company,Domain,Phone,LinkedIn,Seniority,Email Confidence"
    );
  });

  it("CSV data rows match contact data", async () => {
    const res = await POST(
      makeRequest({ contacts: [makeContact()] })
    );
    const text = await res.text();
    const lines = text.split("\n");
    const dataRow = lines[1];

    expect(dataRow).toBe(
      "Jane,Doe,jane@acme.com,VP Sales,Acme Corp,acme.com,+1-555-0100,https://linkedin.com/in/janedoe,VP,92"
    );
  });

  it("escapes CSV fields with commas and quotes", async () => {
    const res = await POST(
      makeRequest({
        contacts: [
          makeContact({
            title: 'VP, Sales & "Growth"',
            companyName: "Acme, Inc.",
          }),
        ],
      })
    );
    const text = await res.text();
    const lines = text.split("\n");
    const dataRow = lines[1];

    // Fields with commas/quotes should be wrapped in quotes with escaped inner quotes
    expect(dataRow).toContain('"VP, Sales & ""Growth"""');
    expect(dataRow).toContain('"Acme, Inc."');
  });

  it("filters contacts without email", async () => {
    const res = await POST(
      makeRequest({
        contacts: [
          makeContact(),
          makeContact({ firstName: "NoEmail", email: null }),
        ],
      })
    );
    const text = await res.text();
    const lines = text.split("\n");

    // Header + 1 data row (the contact without email is filtered)
    expect(lines).toHaveLength(2);
    expect(text).toContain("Jane");
    expect(text).not.toContain("NoEmail");
  });

  it("returns 400 when no contacts have email", async () => {
    const res = await POST(
      makeRequest({
        contacts: [
          makeContact({ email: null }),
          makeContact({ email: null, firstName: "Another" }),
        ],
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("contacts array is required");
  });

  it("with csvColumns filters to only specified columns", async () => {
    const res = await POST(
      makeRequest({
        contacts: [makeContact()],
        csvColumns: ["name", "email"],
      })
    );
    const text = await res.text();
    const lines = text.split("\n");
    const headerLine = lines[0];
    const dataRow = lines[1];

    // "name" key maps to both First Name and Last Name columns
    expect(headerLine).toBe("First Name,Last Name,Email");
    expect(dataRow).toBe("Jane,Doe,jane@acme.com");
  });

  it("returns 500 on error", async () => {
    // Pass a request that will cause JSON parsing to fail
    const badRequest = new NextRequest("http://localhost/api/export/csv", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(badRequest);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("CSV export failed");
  });
});
