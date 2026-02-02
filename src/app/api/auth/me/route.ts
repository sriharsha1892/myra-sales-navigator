import { NextResponse } from "next/server";
import { verifySessionToken, signSessionToken } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { TeamMember, AuthSettings, CompanyNote } from "@/lib/types";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("myra_session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { name } = await verifySessionToken(sessionCookie);

    // Verify member still exists in team
    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("team_members, auth_settings")
      .eq("id", "global")
      .single();

    const teamMembers: TeamMember[] = config?.team_members ?? [];
    const member = teamMembers.find((m) => m.name === name);

    if (!member) {
      return NextResponse.json({ error: "User removed from team" }, { status: 401 });
    }

    // Read configurable session duration
    const authSettings: AuthSettings = config?.auth_settings ?? {};
    const sessionDays = authSettings.sessionDurationDays ?? 30;

    // Sliding session window: re-sign a fresh token on every /me call
    const freshToken = await signSessionToken(
      member.name,
      member.isAdmin,
      sessionDays
    );

    // Fetch unread @mentions (notes mentioning user since lastMentionReadAt, falling back to lastLoginAt)
    let unreadMentions: { noteId: string; companyDomain: string; content: string; authorName: string; createdAt: string }[] = [];
    const mentionCutoff = member.lastMentionReadAt ?? member.lastLoginAt;
    if (mentionCutoff) {
      const { data: notesData } = await supabase
        .from("company_notes")
        .select("*")
        .contains("mentions", [name])
        .gt("created_at", mentionCutoff)
        .order("created_at", { ascending: false })
        .limit(20);

      if (notesData) {
        unreadMentions = notesData.map((n: CompanyNote) => ({
          noteId: n.id,
          companyDomain: n.companyDomain,
          content: n.content,
          authorName: n.authorName,
          createdAt: n.createdAt,
        }));
      }
    }

    const response = NextResponse.json({
      name: member.name,
      isAdmin: member.isAdmin,
      lastLoginAt: member.lastLoginAt ?? null,
      unreadMentions,
    });

    // Set refreshed session cookie
    response.cookies.set("myra_session", freshToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * sessionDays,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    // Token verification failed — expired or tampered
    const response = NextResponse.json({ error: "Session expired" }, { status: 401 });
    response.cookies.set("myra_session", "", { path: "/", maxAge: 0 });
    return response;
  }
}
