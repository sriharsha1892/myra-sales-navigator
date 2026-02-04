import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";

// 32-byte hex key (64 hex chars)
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encrypt + decrypt roundtrip", () => {
  beforeEach(() => {
    process.env.ADMIN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.ADMIN_ENCRYPTION_KEY;
  });

  it("roundtrips plain ASCII", () => {
    const { encrypted, iv } = encrypt("hello world");
    expect(decrypt(encrypted, iv)).toBe("hello world");
  });

  it("roundtrips unicode text", () => {
    const text = "Héllo Wörld 日本語 🎉";
    const { encrypted, iv } = encrypt(text);
    expect(decrypt(encrypted, iv)).toBe(text);
  });

  it("roundtrips empty string", () => {
    const { encrypted, iv } = encrypt("");
    expect(decrypt(encrypted, iv)).toBe("");
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const r1 = encrypt("same");
    const r2 = encrypt("same");
    expect(r1.encrypted).not.toBe(r2.encrypted);
  });
});

describe("decrypt error cases", () => {
  beforeEach(() => {
    process.env.ADMIN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.ADMIN_ENCRYPTION_KEY;
  });

  it("throws on tampered ciphertext", () => {
    const { encrypted, iv } = encrypt("secret");
    const tampered = Buffer.from(encrypted, "base64");
    tampered[0] ^= 0xff;
    expect(() => decrypt(tampered.toString("base64"), iv)).toThrow();
  });

  it("throws on wrong IV length", () => {
    const { encrypted } = encrypt("secret");
    const shortIv = Buffer.from("short").toString("base64");
    expect(() => decrypt(encrypted, shortIv)).toThrow("Invalid IV length");
  });
});

describe("missing / invalid encryption key", () => {
  afterEach(() => {
    delete process.env.ADMIN_ENCRYPTION_KEY;
  });

  it("throws when ADMIN_ENCRYPTION_KEY is not set", () => {
    delete process.env.ADMIN_ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("ADMIN_ENCRYPTION_KEY env var is not set");
  });

  it("throws when key is wrong length (16 bytes)", () => {
    process.env.ADMIN_ENCRYPTION_KEY = "0123456789abcdef"; // 16 chars, not valid hex-64 or 32-byte utf8
    expect(() => encrypt("test")).toThrow("ADMIN_ENCRYPTION_KEY must be 32 bytes");
  });

  it("throws when key is invalid length (10 bytes utf8)", () => {
    process.env.ADMIN_ENCRYPTION_KEY = "short_key!"; // 10 bytes
    expect(() => encrypt("test")).toThrow("ADMIN_ENCRYPTION_KEY must be 32 bytes");
  });
});

describe("maskKey", () => {
  it("masks a typical API key", () => {
    expect(maskKey("sk-abc1234567890xyz")).toBe("sk-****0xyz");
  });

  it("masks key showing first 3 and last 4", () => {
    expect(maskKey("abcdefghijklmnop")).toBe("abc****mnop");
  });

  it("returns **** for short key (<=8 chars)", () => {
    expect(maskKey("12345678")).toBe("****");
    expect(maskKey("short")).toBe("****");
  });

  it("returns **** for empty string", () => {
    expect(maskKey("")).toBe("****");
  });
});
