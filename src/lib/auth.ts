import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.MAGIC_LINK_SECRET || "dev-fallback-secret-not-for-production"
);

// ---------------------------------------------------------------------------
// Magic link tokens (short-lived, for login links)
// ---------------------------------------------------------------------------

export async function signMagicLinkToken(
  email: string,
  name: string,
  expiryMinutes = 60
): Promise<string> {
  return new SignJWT({ email, name, purpose: "magic_link" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiryMinutes}m`)
    .sign(secret);
}

export async function verifyMagicLinkToken(
  token: string
): Promise<{ email: string; name: string }> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.purpose !== "magic_link") {
    throw new Error("Invalid token purpose");
  }
  return { email: payload.email as string, name: payload.name as string };
}

// ---------------------------------------------------------------------------
// Session tokens (long-lived, httpOnly cookie)
// ---------------------------------------------------------------------------

export async function signSessionToken(
  name: string,
  isAdmin: boolean,
  durationDays = 30
): Promise<string> {
  return new SignJWT({ name, isAdmin, purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${durationDays}d`)
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<{ name: string; isAdmin: boolean }> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.purpose !== "session") {
    throw new Error("Invalid token purpose");
  }
  return {
    name: payload.name as string,
    isAdmin: payload.isAdmin as boolean,
  };
}
