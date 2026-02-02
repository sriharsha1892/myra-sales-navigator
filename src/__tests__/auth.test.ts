/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  signMagicLinkToken,
  verifyMagicLinkToken,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth";

describe("signMagicLinkToken + verifyMagicLinkToken", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("roundtrips email and name", async () => {
    const token = await signMagicLinkToken("adi@ask-myra.ai", "Adi");
    const payload = await verifyMagicLinkToken(token);
    expect(payload.email).toBe("adi@ask-myra.ai");
    expect(payload.name).toBe("Adi");
  });

  it("produces a non-empty JWT string", async () => {
    const token = await signMagicLinkToken("test@test.com", "Test");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(token.split(".")).toHaveLength(3);
  });

  it("throws for expired token", async () => {
    vi.useFakeTimers();
    const token = await signMagicLinkToken("test@test.com", "Test");
    // Default expiry is 60 minutes — advance past that
    vi.advanceTimersByTime(61 * 60 * 1000);
    await expect(verifyMagicLinkToken(token)).rejects.toThrow();
  });

  it("throws for tampered token", async () => {
    const token = await signMagicLinkToken("test@test.com", "Test");
    const tampered = token.slice(0, -5) + "XXXXX";
    await expect(verifyMagicLinkToken(tampered)).rejects.toThrow();
  });

  it("works with empty email and name", async () => {
    const token = await signMagicLinkToken("", "");
    const payload = await verifyMagicLinkToken(token);
    expect(payload.email).toBe("");
    expect(payload.name).toBe("");
  });

  it("handles unicode in name", async () => {
    const token = await signMagicLinkToken("user@test.com", "Ünïcödé");
    const payload = await verifyMagicLinkToken(token);
    expect(payload.name).toBe("Ünïcödé");
  });

  it("different emails produce different tokens", async () => {
    const t1 = await signMagicLinkToken("a@test.com", "A");
    const t2 = await signMagicLinkToken("b@test.com", "B");
    expect(t1).not.toBe(t2);
  });

  it("valid token just before expiry works", async () => {
    vi.useFakeTimers();
    const token = await signMagicLinkToken("test@test.com", "Test");
    // Default expiry is 60 minutes — advance to just before
    vi.advanceTimersByTime(59 * 60 * 1000);
    const payload = await verifyMagicLinkToken(token);
    expect(payload.email).toBe("test@test.com");
  });

  it("respects custom expiry", async () => {
    vi.useFakeTimers();
    const token = await signMagicLinkToken("test@test.com", "Test", 15);
    // Should still be valid at 14 minutes
    vi.advanceTimersByTime(14 * 60 * 1000);
    const payload = await verifyMagicLinkToken(token);
    expect(payload.email).toBe("test@test.com");
    // Should expire after 16 minutes
    vi.advanceTimersByTime(2 * 60 * 1000);
    await expect(verifyMagicLinkToken(token)).rejects.toThrow();
  });
});

describe("signSessionToken + verifySessionToken", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("roundtrips name and isAdmin", async () => {
    const token = await signSessionToken("Adi", true);
    const payload = await verifySessionToken(token);
    expect(payload.name).toBe("Adi");
    expect(payload.isAdmin).toBe(true);
  });

  it("non-admin roundtrip", async () => {
    const token = await signSessionToken("Satish", false);
    const payload = await verifySessionToken(token);
    expect(payload.name).toBe("Satish");
    expect(payload.isAdmin).toBe(false);
  });

  it("rejects magic link token as session token", async () => {
    const magicToken = await signMagicLinkToken("test@test.com", "Test");
    await expect(verifySessionToken(magicToken)).rejects.toThrow();
  });

  it("rejects session token as magic link token", async () => {
    const sessionToken = await signSessionToken("Adi", true);
    await expect(verifyMagicLinkToken(sessionToken)).rejects.toThrow();
  });

  it("throws for expired session token", async () => {
    vi.useFakeTimers();
    const token = await signSessionToken("Adi", true, 1); // 1 day
    vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
    await expect(verifySessionToken(token)).rejects.toThrow();
  });

  it("valid session token before expiry", async () => {
    vi.useFakeTimers();
    const token = await signSessionToken("Adi", true, 1); // 1 day
    vi.advanceTimersByTime(23 * 60 * 60 * 1000); // 23 hours
    const payload = await verifySessionToken(token);
    expect(payload.name).toBe("Adi");
  });

  it("throws for tampered session token", async () => {
    const token = await signSessionToken("Adi", true);
    const tampered = token.slice(0, -5) + "ZZZZZ";
    await expect(verifySessionToken(tampered)).rejects.toThrow();
  });
});
