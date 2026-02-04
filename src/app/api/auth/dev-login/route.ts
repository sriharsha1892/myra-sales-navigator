import { NextResponse } from "next/server";
import { signSessionToken } from "@/lib/navigator/auth";

/**
 * DEV ONLY — bypass magic link for local testing.
 * Usage: POST /api/auth/dev-login { "name": "SriHarsha", "isAdmin": true }
 * Or just visit: /api/auth/dev-login?name=SriHarsha&admin=1
 */

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "SriHarsha";
  const isAdmin = searchParams.get("admin") === "1";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3877";

  const sessionToken = await signSessionToken(name, isAdmin, 30);

  const response = NextResponse.redirect(new URL("/", appUrl));
  response.cookies.set("myra_session", sessionToken, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: false,
  });

  return response;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { name = "SriHarsha", isAdmin = false } = await request.json();
  const sessionToken = await signSessionToken(name, isAdmin, 30);

  const response = NextResponse.json({ success: true, name, isAdmin });
  response.cookies.set("myra_session", sessionToken, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: false,
  });

  return response;
}
