import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { TeamMember, AuthAccessRequest } from "@/lib/types";
import { logAuthEvent } from "@/lib/auth-log";

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const supabase = createServerClient();
  const { data: config } = await supabase
    .from("admin_config")
    .select("team_members, auth_requests")
    .eq("id", "global")
    .single();

  const teamMembers: TeamMember[] = config?.team_members ?? [];
  const member = teamMembers.find(
    (m) => m.email.toLowerCase() === normalizedEmail
  );

  if (!member) {
    return NextResponse.json(
      { error: "Email not found in team. Contact your admin." },
      { status: 404 }
    );
  }

  // Check for duplicate pending request
  const existingRequests: AuthAccessRequest[] = config?.auth_requests ?? [];
  const alreadyRequested = existingRequests.some(
    (r) => r.email.toLowerCase() === normalizedEmail
  );

  if (!alreadyRequested) {
    const newRequest: AuthAccessRequest = {
      email: normalizedEmail,
      name: member.name,
      requestedAt: new Date().toISOString(),
    };

    await supabase
      .from("admin_config")
      .update({
        auth_requests: [...existingRequests, newRequest],
      })
      .eq("id", "global");

    await logAuthEvent("requested_access", member.name, member.name);
  }

  return NextResponse.json({ success: true, name: member.name });
}
