import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({});
  }

  try {
    const supabase = createClient(url, key);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("signals")
      .select("type")
      .gte("created_at", weekAgo);

    if (error || !data) {
      return NextResponse.json({});
    }

    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.type] = (counts[row.type] ?? 0) + 1;
    }

    return NextResponse.json(counts);
  } catch {
    return NextResponse.json({});
  }
}
