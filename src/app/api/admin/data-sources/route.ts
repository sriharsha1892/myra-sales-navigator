import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("admin_config")
      .select("data_sources")
      .eq("id", "global")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dataSources: data.data_sources ?? [] });
  } catch (err) {
    console.error("GET /api/admin/data-sources error:", err);
    return NextResponse.json({ error: "Failed to fetch data sources" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const source = await request.json();

    if (!source.id || !source.name || !source.type || !source.baseUrl) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, type, baseUrl" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: config } = await supabase
      .from("admin_config")
      .select("data_sources")
      .eq("id", "global")
      .single();

    const existing = config?.data_sources ?? [];
    const { error } = await supabase
      .from("admin_config")
      .update({
        data_sources: [...existing, source],
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, source });
  } catch (err) {
    console.error("POST /api/admin/data-sources error:", err);
    return NextResponse.json({ error: "Failed to add data source" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();
    const supabase = createServerClient();

    const { data: config } = await supabase
      .from("admin_config")
      .select("data_sources")
      .eq("id", "global")
      .single();

    const sources = (config?.data_sources ?? []).map((ds: Record<string, unknown>) =>
      ds.id === id ? { ...ds, ...updates } : ds
    );

    const { error } = await supabase
      .from("admin_config")
      .update({ data_sources: sources, updated_at: new Date().toISOString() })
      .eq("id", "global");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/admin/data-sources error:", err);
    return NextResponse.json({ error: "Failed to update data source" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    const supabase = createServerClient();

    const { data: config } = await supabase
      .from("admin_config")
      .select("data_sources")
      .eq("id", "global")
      .single();

    const sources = (config?.data_sources ?? []).filter((ds: Record<string, unknown>) => ds.id !== id);

    const { error } = await supabase
      .from("admin_config")
      .update({ data_sources: sources, updated_at: new Date().toISOString() })
      .eq("id", "global");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/admin/data-sources error:", err);
    return NextResponse.json({ error: "Failed to delete data source" }, { status: 500 });
  }
}
