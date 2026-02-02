import { SignJWT } from "jose";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadSecret(): string {
  // Try reading from .env.local (same as Next.js dev server uses)
  try {
    const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
    const match = envFile.match(/^MAGIC_LINK_SECRET=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // .env.local not found — fall through
  }
  return process.env.MAGIC_LINK_SECRET || "dev-fallback-secret-not-for-production";
}

const secret = new TextEncoder().encode(loadSecret());

/**
 * Generate a valid myra_session JWT cookie for e2e tests.
 */
export async function getSessionCookie(
  name = "Adi",
  isAdmin = true
): Promise<{ name: string; value: string; domain: string; path: string }> {
  const token = await new SignJWT({ name, isAdmin, purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return { name: "myra_session", value: token, domain: "localhost", path: "/" };
}
