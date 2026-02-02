import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the httpOnly session cookie server-side
  response.cookies.set("myra_session", "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // Also clear legacy cookie
  response.cookies.set("myra_user", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}
