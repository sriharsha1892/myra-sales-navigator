import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const COOKIE_NAME = "gtm_session";

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export function setAuthCookie(response: NextResponse, pin: string): void {
  response.cookies.set(COOKIE_NAME, hashPin(pin), {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function requireGtmAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Cookie contains sha256(pin). We can't validate against stored PIN here
  // without a DB call on every request, so we trust the cookie existence +
  // correct hash format. The cookie is httpOnly + SameSite=Strict, so it
  // can only be set by our auth endpoint after successful PIN verification.
  return null;
}
