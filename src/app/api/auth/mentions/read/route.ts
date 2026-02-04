import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/navigator/auth";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { TeamMember } from "@/lib/navigator/types";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("myra_session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { name } = await verifySessionToken(sessionCookie);

    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("team_members")
      .eq("id", "global")
      .single();

    const teamMembers: TeamMember[] = config?.team_members ?? [];
    const updatedMembers = teamMembers.map((m) =>
      m.name === name
        ? { ...m, lastMentionReadAt: new Date().toISOString() }
        : m
    );

    await supabase
      .from("admin_config")
      .update({ team_members: updatedMembers })
      .eq("id", "global");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }
}
