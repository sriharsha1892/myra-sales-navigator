import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { UserConfig } from "@/lib/navigator/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): UserConfig {
  return {
    userName: row.user_name,
    freshsalesDomain: row.freshsales_domain ?? null,
    hasLinkedinSalesNav: row.has_linkedin_sales_nav ?? false,
    preferences: row.preferences ?? {},
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const DEFAULTS: UserConfig = {
  userName: "",
  freshsalesDomain: null,
  hasLinkedinSalesNav: false,
  preferences: {},
};

export async function GET() {
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_config")
      .select("*")
      .eq("user_name", userName)
      .single();

    if (error || !data) {
      return NextResponse.json({ ...DEFAULTS, userName });
    }

    return NextResponse.json(mapRow(data));
  } catch (err) {
    console.error("[UserConfig] GET error:", err);
    return NextResponse.json({ ...DEFAULTS, userName });
  }
}

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Partial<UserConfig>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("user_config")
      .upsert(
        {
          user_name: userName,
          freshsales_domain: body.freshsalesDomain ?? null,
          has_linkedin_sales_nav: body.hasLinkedinSalesNav ?? false,
          preferences: body.preferences ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_name" }
      )
      .select()
      .single();

    if (error) {
      console.error("[UserConfig] PUT error:", error);
      return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
    }

    return NextResponse.json(mapRow(data));
  } catch (err) {
    console.error("[UserConfig] PUT error:", err);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
