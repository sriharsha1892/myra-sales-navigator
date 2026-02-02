import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { clearCache } from "@/lib/cache";

// Mock environment
vi.stubEnv("CLEAROUT_API_KEY", "test-clearout-key");

// Must import after env stub
const {
  isClearoutAvailable,
  verifyEmail,
  verifyEmails,
  getClearoutCredits,
} = await import("@/lib/providers/clearout");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function mockVerifyResponse(status: string, safeToSend: boolean) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: { status, safe_to_send: safeToSend } }),
  };
}

describe("clearout provider", () => {
  beforeEach(async () => {
    await clearCache();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isClearoutAvailable", () => {
    it("returns true when CLEAROUT_API_KEY is set", () => {
      expect(isClearoutAvailable()).toBe(true);
    });
  });

  describe("verifyEmail", () => {
    it("maps valid + safe_to_send to score 95", async () => {
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("valid", true));
      const result = await verifyEmail("test@example.com");
      expect(result).toEqual({
        email: "test@example.com",
        status: "valid",
        score: 95,
      });
    });

    it("maps valid + unsafe to score 70", async () => {
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("valid", false));
      const result = await verifyEmail("risky@example.com");
      expect(result).toEqual({
        email: "risky@example.com",
        status: "valid",
        score: 70,
      });
    });

    it("maps unknown to score 50", async () => {
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("unknown", false));
      const result = await verifyEmail("unknown@example.com");
      expect(result).toEqual({
        email: "unknown@example.com",
        status: "unknown",
        score: 50,
      });
    });

    it("maps invalid to score 10", async () => {
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("invalid", false));
      const result = await verifyEmail("bad@example.com");
      expect(result).toEqual({
        email: "bad@example.com",
        status: "invalid",
        score: 10,
      });
    });

    it("sends correct headers and body", async () => {
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("valid", true));
      await verifyEmail("test@example.com");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.clearout.io/v2/email_verify/instant",
        {
          method: "POST",
          headers: {
            Authorization: "test-clearout-key",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: "test@example.com" }),
        }
      );
    });

    it("throws on 401 (invalid key)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(verifyEmail("test@example.com")).rejects.toThrow(
        "Invalid Clearout API key"
      );
    });

    it("throws on 402 (credits exhausted)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 402 });
      await expect(verifyEmail("test@example.com")).rejects.toThrow(
        "Clearout credits exhausted"
      );
    });

    it("returns cached result on second call", async () => {
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("valid", true));
      await verifyEmail("cached@example.com");
      const result = await verifyEmail("cached@example.com");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.score).toBe(95);
    });
  });

  describe("verifyEmails (batch)", () => {
    it("returns results in original email order", async () => {
      const emails = ["a@test.com", "b@test.com", "c@test.com"];
      fetchMock
        .mockResolvedValueOnce(mockVerifyResponse("valid", true))
        .mockResolvedValueOnce(mockVerifyResponse("invalid", false))
        .mockResolvedValueOnce(mockVerifyResponse("unknown", false));

      const results = await verifyEmails(emails);

      expect(results.map((r) => r.email)).toEqual(emails);
      expect(results[0].score).toBe(95);
      expect(results[1].score).toBe(10);
      expect(results[2].score).toBe(50);
    });

    it("skips cached emails and only verifies uncached ones", async () => {
      // Pre-cache one email
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("valid", true));
      await verifyEmail("cached@test.com");
      fetchMock.mockReset();

      // Now batch verify including the cached one
      fetchMock.mockResolvedValueOnce(mockVerifyResponse("invalid", false));
      const results = await verifyEmails(["cached@test.com", "new@test.com"]);

      expect(fetchMock).toHaveBeenCalledTimes(1); // only new@test.com
      expect(results[0].score).toBe(95); // from cache
      expect(results[1].score).toBe(10); // freshly verified
    });

    it("handles empty array", async () => {
      const results = await verifyEmails([]);
      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("getClearoutCredits", () => {
    it("returns credit count", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { credits: 500 } }),
      });
      const credits = await getClearoutCredits();
      expect(credits).toBe(500);
    });

    it("returns null on error", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      const credits = await getClearoutCredits();
      expect(credits).toBeNull();
    });
  });
});
