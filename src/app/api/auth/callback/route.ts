import { NextResponse } from "next/server";
import { verifyMagicLinkToken, signSessionToken } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { TeamMember, AuthSettings } from "@/lib/types";
import { logAuthEvent } from "@/lib/auth-log";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3877";

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=missing_token", appUrl)
    );
  }

  try {
    const { email } = await verifyMagicLinkToken(token);

    // Look up member in Supabase to get current isAdmin status
    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("team_members, auth_settings")
      .eq("id", "global")
      .single();

    const teamMembers: TeamMember[] = config?.team_members ?? [];
    const member = teamMembers.find(
      (m) => m.email.toLowerCase() === email.toLowerCase()
    );

    if (!member) {
      return NextResponse.redirect(
        new URL("/login?error=not_found", appUrl)
      );
    }

    // Read configurable session duration
    const authSettings: AuthSettings = config?.auth_settings ?? {};
    const sessionDays = authSettings.sessionDurationDays ?? 30;

    // Sign session JWT
    const sessionToken = await signSessionToken(
      member.name,
      member.isAdmin,
      sessionDays
    );

    // Update lastLoginAt in Supabase
    const updatedMembers = teamMembers.map((m) =>
      m.email.toLowerCase() === email.toLowerCase()
        ? { ...m, lastLoginAt: new Date().toISOString() }
        : m
    );
    await supabase
      .from("admin_config")
      .update({ team_members: updatedMembers })
      .eq("id", "global");

    // Log auth event
    await logAuthEvent("logged_in", member.name, member.name);

    // Determine redirect URL — check for return-to cookie
    const cookieHeader = request.headers.get("cookie") ?? "";
    const returnToMatch = cookieHeader.match(/myra_return_to=([^;]+)/);
    let redirectPath = "/";
    if (returnToMatch) {
      const decoded = decodeURIComponent(returnToMatch[1]);
      // Validate it's a relative path
      if (decoded.startsWith("/") && !decoded.startsWith("//")) {
        redirectPath = decoded;
      }
    }

    const response = NextResponse.redirect(new URL(redirectPath, appUrl));

    // Set httpOnly session cookie
    response.cookies.set("myra_session", sessionToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * sessionDays,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    // Set just-logged-in flag (not httpOnly, short-lived — for welcome toast)
    response.cookies.set("myra_just_logged_in", "1", {
      path: "/",
      maxAge: 60,
      sameSite: "lax",
      httpOnly: false,
    });

    // Clear return-to cookie
    response.cookies.set("myra_return_to", "", {
      path: "/",
      maxAge: 0,
    });

    // Remove legacy cookie
    response.cookies.set("myra_user", "", {
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=expired", appUrl)
    );
  }
}
