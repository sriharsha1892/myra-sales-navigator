import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    filters: row.filters,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastResultCount: row.last_result_count ?? undefined,
    newResultCount: row.new_result_count ?? undefined,
    lastCheckedAt: row.last_checked_at ?? undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("search_presets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Presets] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 });
    }

    const presets = (data ?? []).map(mapRow);

    return NextResponse.json({ presets });
  } catch (err) {
    console.error("[Presets] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, filters, createdBy } = await request.json();
    if (!name || !filters || !createdBy) {
      return NextResponse.json(
        { error: "name, filters, and createdBy are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("search_presets")
      .insert({ name, filters, created_by: createdBy })
      .select()
      .single();

    if (error) {
      console.error("[Presets] insert error:", error);
      return NextResponse.json({ error: "Failed to create preset" }, { status: 500 });
    }

    return NextResponse.json({ preset: mapRow(data) });
  } catch (err) {
    console.error("[Presets] POST error:", err);
    return NextResponse.json({ error: "Failed to create preset" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("search_presets")
      .update({ new_result_count: 0 })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Presets] PATCH error:", error);
      return NextResponse.json({ error: "Failed to update preset" }, { status: 500 });
    }

    return NextResponse.json({ preset: mapRow(data) });
  } catch (err) {
    console.error("[Presets] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update preset" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("search_presets").delete().eq("id", id);

    if (error) {
      console.error("[Presets] delete error:", error);
      return NextResponse.json({ error: "Failed to delete preset" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[Presets] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete preset" }, { status: 500 });
  }
}
