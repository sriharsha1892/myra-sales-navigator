import { NextResponse } from "next/server";
import { signSessionToken } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/types";

const ADMIN_NAMES = ["SriHarsha", "Adi", "JVS", "Reddy", "Sai"];

export async function POST(request: Request) {
  const { name, password } = (await request.json()) as {
    name?: string;
    password?: string;
  };

  if (!name || !password) {
    return NextResponse.json(
      { error: "Name and password are required" },
      { status: 400 }
    );
  }

  // Check shared team password
  const teamPassword = process.env.TEAM_PASSWORD;
  if (!teamPassword || password !== teamPassword) {
    return NextResponse.json(
      { error: "Incorrect password" },
      { status: 401 }
    );
  }

  const isAdmin = ADMIN_NAMES.includes(name);

  // Update lastLoginAt in Supabase
  try {
    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("team_members")
      .eq("id", "global")
      .single();

    const teamMembers: TeamMember[] = config?.team_members ?? [];
    const updatedMembers = teamMembers.map((m) =>
      m.name === name
        ? { ...m, lastLoginAt: new Date().toISOString() }
        : m
    );
    await supabase
      .from("admin_config")
      .update({ team_members: updatedMembers })
      .eq("id", "global");
  } catch {
    // Non-blocking — login still works even if Supabase update fails
  }

  // Sign session JWT (30 days)
  const sessionToken = await signSessionToken(name, isAdmin, 30);

  const response = NextResponse.json({ success: true, name, isAdmin });
  response.cookies.set("myra_session", sessionToken, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
