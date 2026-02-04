import { NextResponse } from "next/server";
import { signMagicLinkToken } from "@/lib/navigator/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { TeamMember, AuthSettings } from "@/lib/navigator/types";
import { logAuthEvent } from "@/lib/navigator/auth-log";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; emails?: string[] };

  const supabase = createServerClient();
  const { data: config } = await supabase
    .from("admin_config")
    .select("team_members, auth_settings")
    .eq("id", "global")
    .single();

  const teamMembers: TeamMember[] = config?.team_members ?? [];
  const authSettings: AuthSettings = config?.auth_settings ?? {};
  const expiryMinutes = authSettings.magicLinkExpiryMinutes ?? 60;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3877";

  // Batch mode: generate links for multiple emails
  if (body.emails && Array.isArray(body.emails)) {
    const links: { name: string; email: string; url: string; expiresIn: string }[] = [];
    const errors: { email: string; error: string }[] = [];

    for (const email of body.emails) {
      const normalized = email.trim().toLowerCase();
      const member = teamMembers.find(
        (m) => m.email.toLowerCase() === normalized
      );

      if (!member) {
        errors.push({ email: normalized, error: "Not found" });
        continue;
      }

      const token = await signMagicLinkToken(member.email, member.name, expiryMinutes);
      const url = `${appUrl}/api/auth/callback?token=${token}`;
      links.push({ name: member.name, email: member.email, url, expiresIn: `${expiryMinutes} minutes` });

      await logAuthEvent("generated_link", "admin", member.name);
    }

    return NextResponse.json({ links, errors });
  }

  // Single mode: generate link for one email
  if (!body.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = body.email.trim().toLowerCase();
  const member = teamMembers.find(
    (m) => m.email.toLowerCase() === normalizedEmail
  );

  if (!member) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const token = await signMagicLinkToken(member.email, member.name, expiryMinutes);
  const url = `${appUrl}/api/auth/callback?token=${token}`;

  await logAuthEvent("generated_link", "admin", member.name);

  return NextResponse.json({ url, name: member.name, expiresIn: `${expiryMinutes} minutes` });
}
