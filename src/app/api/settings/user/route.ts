import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { verifySessionToken } from "@/lib/navigator/auth";

async function resolveUserName(request: NextRequest): Promise<string | null> {
  // Explicit query param takes priority
  const fromParam = request.nextUrl.searchParams.get("user");
  if (fromParam) return fromParam;

  // Fall back to session JWT
  const sessionToken = request.cookies.get("myra_session")?.value;
  if (sessionToken) {
    try {
      const { name } = await verifySessionToken(sessionToken);
      return name;
    } catch { /* invalid token */ }
  }

  // Fall back to legacy cookie
  const legacyCookie = request.cookies.get("myra_user")?.value;
  if (legacyCookie) return decodeURIComponent(legacyCookie);

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const userName = await resolveUserName(request);
    if (!userName) {
      return NextResponse.json({ error: "Could not determine user" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_name", userName)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found — that's OK, return defaults
      console.error("[UserSettings] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        settings: {
          userName,
          defaultCopyFormat: "{{first_name}} {{last_name}} <{{email}}>",
          defaultView: "companies",
          defaultSort: { field: "icp_score", direction: "desc" },
          recentDomains: [],
        },
      });
    }

    return NextResponse.json({
      settings: {
        userName: data.user_name,
        defaultCopyFormat: data.default_copy_format ?? "{{first_name}} {{last_name}} <{{email}}>",
        defaultView: data.default_view,
        defaultSort: data.default_sort,
        recentDomains: data.recent_domains ?? [],
      },
    });
  } catch (err) {
    console.error("[UserSettings] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, ...updates } = body;
    if (!userName) {
      return NextResponse.json({ error: "userName is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Build upsert row — only include fields that were sent
    const row: Record<string, unknown> = {
      user_name: userName,
      updated_at: new Date().toISOString(),
    };
    if (updates.defaultCopyFormat !== undefined) row.default_copy_format = updates.defaultCopyFormat;
    if (updates.defaultView !== undefined) row.default_view = updates.defaultView;
    if (updates.defaultSort !== undefined) row.default_sort = updates.defaultSort;
    if (updates.recentDomains !== undefined) row.recent_domains = updates.recentDomains;
    if (updates.panelWidths !== undefined) row.panel_widths = updates.panelWidths;

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(row, { onConflict: "user_name" })
      .select()
      .single();

    if (error) {
      console.error("[UserSettings] PUT error:", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({
      settings: {
        userName: data.user_name,
        defaultCopyFormat: data.default_copy_format,
        defaultView: data.default_view,
        defaultSort: data.default_sort,
        recentDomains: data.recent_domains ?? [],
      },
    });
  } catch (err) {
    console.error("[UserSettings] PUT error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
