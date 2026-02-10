import { NextResponse } from "next/server";
import { signSessionToken } from "@/lib/navigator/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/lib/navigator/types";

const ADMIN_NAMES = ["SriHarsha", "Adi", "JVS", "Reddy", "Sai"];

// --- Brute-force rate limiting ---
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const failedAttempts = new Map<string, AttemptRecord>();

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { blocked: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const record = failedAttempts.get(ip);

  if (!record) return { blocked: false, retryAfterMinutes: 0 };

  // Window expired — clear the record
  if (now - record.firstAttemptAt > WINDOW_MS) {
    failedAttempts.delete(ip);
    return { blocked: false, retryAfterMinutes: 0 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const elapsedMs = now - record.firstAttemptAt;
    const remainingMs = WINDOW_MS - elapsedMs;
    const retryAfterMinutes = Math.ceil(remainingMs / 60_000);
    return { blocked: true, retryAfterMinutes };
  }

  return { blocked: false, retryAfterMinutes: 0 };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = failedAttempts.get(ip);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttemptAt: now });
  } else {
    record.count += 1;
  }
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Check rate limit before processing
  const { blocked, retryAfterMinutes } = checkRateLimit(ip);
  if (blocked) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? "" : "s"}.` },
      { status: 429 }
    );
  }

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
    recordFailedAttempt(ip);
    return NextResponse.json(
      { error: "Incorrect password" },
      { status: 401 }
    );
  }

  // Successful login — clear any failed attempt history
  clearFailedAttempts(ip);

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
