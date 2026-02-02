import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ADMIN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ADMIN_ENCRYPTION_KEY env var is not set");
  }
  // Key must be 32 bytes for AES-256. Accept hex-encoded (64 chars) or raw 32-byte string.
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  const buf = Buffer.from(key, "utf-8");
  if (buf.length !== 32) {
    throw new Error("ADMIN_ENCRYPTION_KEY must be 32 bytes (or 64 hex chars)");
  }
  return buf;
}

export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Append auth tag to ciphertext
  const combined = Buffer.concat([
    Buffer.from(encrypted, "base64"),
    authTag,
  ]);

  return {
    encrypted: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(encrypted: string, iv: string): string {
  const key = getEncryptionKey();
  const ivBuf = Buffer.from(iv, "base64");
  if (ivBuf.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${ivBuf.length}`);
  }
  const combined = Buffer.from(encrypted, "base64");

  // Split ciphertext and auth tag
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/** Mask an API key for display: show first 3 + last 4 chars */
export function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}
