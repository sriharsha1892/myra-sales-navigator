import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("exclusions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Exclusions] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch exclusions" }, { status: 500 });
    }

    const exclusions = (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      value: row.value,
      reason: row.reason ?? undefined,
      addedBy: row.added_by,
      addedAt: row.created_at,
      source: row.source ?? "manual",
    }));

    return NextResponse.json({ exclusions });
  } catch (err) {
    console.error("[Exclusions] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch exclusions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Bulk CSV upload
    if (Array.isArray(body.items)) {
      const rows = body.items.map((item: { type: string; value: string; reason?: string }) => ({
        type: item.type || "domain",
        value: item.value,
        reason: item.reason ?? null,
        added_by: body.addedBy || "Unknown",
        source: body.source || "csv_upload",
      }));

      const { error, count } = await supabase
        .from("exclusions")
        .insert(rows, { count: "exact" });

      if (error) {
        console.error("[Exclusions] bulk insert error:", error);
        return NextResponse.json({ error: "Bulk insert failed" }, { status: 500 });
      }

      return NextResponse.json({ inserted: count ?? rows.length });
    }

    // Single exclusion
    const { type, value, reason, addedBy } = body;
    if (!type || !value || !addedBy) {
      return NextResponse.json(
        { error: "type, value, and addedBy are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("exclusions")
      .insert({
        type,
        value,
        reason: reason ?? null,
        added_by: addedBy,
        source: "manual",
      })
      .select()
      .single();

    if (error) {
      console.error("[Exclusions] insert error:", error);
      return NextResponse.json({ error: "Failed to add exclusion" }, { status: 500 });
    }

    return NextResponse.json({
      exclusion: {
        id: data.id,
        type: data.type,
        value: data.value,
        reason: data.reason ?? undefined,
        addedBy: data.added_by,
        addedAt: data.created_at,
        source: data.source,
      },
    });
  } catch (err) {
    console.error("[Exclusions] POST error:", err);
    return NextResponse.json({ error: "Failed to add exclusion" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from("exclusions").delete().eq("id", id);

    if (error) {
      console.error("[Exclusions] delete error:", error);
      return NextResponse.json({ error: "Failed to delete exclusion" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[Exclusions] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete exclusion" }, { status: 500 });
  }
}
