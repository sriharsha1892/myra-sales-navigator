import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — Clearout provider
// ---------------------------------------------------------------------------

vi.mock("@/lib/navigator/providers/clearout", () => ({
  isClearoutAvailable: vi.fn(),
  verifyEmails: vi.fn(),
}));

import { POST } from "@/app/api/contact/verify/route";
import {
  isClearoutAvailable,
  verifyEmails,
} from "@/lib/navigator/providers/clearout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callPOST(body: unknown) {
  const request = new NextRequest("http://localhost/api/contact/verify", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return POST(request);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/contact/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isClearoutAvailable).mockReturnValue(true);
  });

  it("returns 503 when Clearout is not configured", async () => {
    vi.mocked(isClearoutAvailable).mockReturnValue(false);

    const res = await callPOST({ emails: ["test@example.com"] });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.results).toEqual([]);
    expect(data.error).toMatch(/clearout api key not configured/i);
  });

  it("returns 400 when emails field is not provided", async () => {
    const res = await callPOST({});

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/emails must be a non-empty array/i);
  });

  it("returns 400 when emails is an empty array", async () => {
    const res = await callPOST({ emails: [] });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/emails must be a non-empty array/i);
  });

  it("returns 400 when emails exceeds 50", async () => {
    const emails = Array.from({ length: 51 }, (_, i) => `user${i}@test.com`);
    const res = await callPOST({ emails });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/maximum 50 emails/i);
  });

  it("returns verification results for valid emails", async () => {
    const mockResults = [
      { email: "valid@test.com", status: "valid", score: 95 },
      { email: "risky@test.com", status: "risky", score: 60 },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(verifyEmails).mockResolvedValue(mockResults as any);

    const res = await callPOST({
      emails: ["valid@test.com", "risky@test.com"],
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual(mockResults);
    expect(verifyEmails).toHaveBeenCalledWith([
      "valid@test.com",
      "risky@test.com",
    ]);
  });

  it("returns 401 on Invalid Clearout API key error", async () => {
    vi.mocked(verifyEmails).mockRejectedValue(
      new Error("Invalid Clearout API key")
    );

    const res = await callPOST({ emails: ["test@example.com"] });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/invalid clearout api key/i);
  });

  it("returns 402 on Credits exhausted error", async () => {
    vi.mocked(verifyEmails).mockRejectedValue(
      new Error("Credits exhausted")
    );

    const res = await callPOST({ emails: ["test@example.com"] });

    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toMatch(/credits exhausted/i);
  });

  it("returns 500 on generic error", async () => {
    vi.mocked(verifyEmails).mockRejectedValue(
      new Error("Network timeout")
    );

    const res = await callPOST({ emails: ["test@example.com"] });

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Network timeout");
  });
});
