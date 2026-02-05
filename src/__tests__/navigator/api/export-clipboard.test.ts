/** @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/export/clipboard/route";

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
    ...overrides,
  };
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/export/clipboard", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// --- Tests -------------------------------------------------------------------

describe("POST /api/export/clipboard", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockReturnValue(fakeTable());
  });

  it("applies default template to contacts", async () => {
    const res = await POST(
      makeRequest({
        contacts: [makeContact()],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("Jane Doe <jane@acme.com>");
  });

  it("applies custom format template", async () => {
    const res = await POST(
      makeRequest({
        contacts: [makeContact()],
        format: "{{email}} - {{first_name}} {{last_name}} ({{company}})",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("jane@acme.com - Jane Doe (Acme Corp)");
  });

  it("filters out contacts where email is null", async () => {
    const res = await POST(
      makeRequest({
        contacts: [
          makeContact(),
          makeContact({ firstName: "No", lastName: "Email", email: null }),
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.skipped).toBe(1);
    expect(body.text).toBe("Jane Doe <jane@acme.com>");
  });

  it("returns correct text, count, and skipped", async () => {
    const res = await POST(
      makeRequest({
        contacts: [
          makeContact({ firstName: "Alice", email: "alice@x.com" }),
          makeContact({ firstName: "Bob", email: "bob@x.com" }),
          makeContact({ firstName: "Charlie", email: null }),
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.text).toContain("Alice");
    expect(body.text).toContain("Bob");
    expect(body.text.split("\n")).toHaveLength(2);
  });

  it("returns 400 when all contacts have null email", async () => {
    const res = await POST(
      makeRequest({
        contacts: [
          makeContact({ email: null }),
          makeContact({ email: null, firstName: "Another" }),
        ],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("contacts array is required");
  });

  it("returns 400 when contacts array is empty", async () => {
    const res = await POST(
      makeRequest({
        contacts: [],
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("contacts array is required");
  });

  it("logs to Supabase when userName and companyDomain are provided", async () => {
    const chain = fakeTable();
    mockFrom.mockReturnValue(chain);

    const res = await POST(
      makeRequest({
        contacts: [makeContact()],
        companyDomain: "acme.com",
        userName: "Satish",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);

    // Verify companies upsert was called
    expect(mockFrom).toHaveBeenCalledWith("companies");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "acme.com",
        first_viewed_by: "Satish",
        last_viewed_by: "Satish",
        source: "export",
      }),
      expect.objectContaining({ onConflict: "domain" })
    );

    // Verify contact_extractions insert was called
    expect(mockFrom).toHaveBeenCalledWith("contact_extractions");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_domain: "acme.com",
        extracted_by: "Satish",
        destination: "clipboard",
      })
    );
  });

  it("handles Supabase logging failure gracefully", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "companies") {
        throw new Error("Supabase down");
      }
      return fakeTable();
    });

    const res = await POST(
      makeRequest({
        contacts: [makeContact()],
        companyDomain: "acme.com",
        userName: "Satish",
      })
    );
    const body = await res.json();

    // Should still succeed — logging is non-blocking
    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.text).toBe("Jane Doe <jane@acme.com>");
  });

  it("returns 500 on thrown error", async () => {
    // Pass a request that will cause JSON parsing to fail
    const badRequest = new NextRequest("http://localhost/api/export/clipboard", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(badRequest);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Export failed");
  });
});
