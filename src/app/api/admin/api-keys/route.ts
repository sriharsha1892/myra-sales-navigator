import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { encrypt, maskKey } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { source, label, plainKey, addedBy } = await request.json();

    if (!source || !plainKey || !addedBy) {
      return NextResponse.json({ error: "source, plainKey, and addedBy are required" }, { status: 400 });
    }

    const { encrypted, iv } = encrypt(plainKey);
    const id = `key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const entry = {
      id,
      source,
      label: label || source,
      encryptedKey: encrypted,
      iv,
      lastRotated: new Date().toISOString(),
      lastTested: null,
      testStatus: "untested" as const,
      addedBy,
    };

    // Add to admin_config.api_keys array
    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("api_keys")
      .eq("id", "global")
      .single();

    const existing = config?.api_keys ?? [];
    const { error } = await supabase
      .from("admin_config")
      .update({
        api_keys: [...existing, entry],
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit
    await supabase.from("api_key_audit_log").insert({
      source_id: id,
      action: "created",
      actor: addedBy,
      result: `Key for ${source} created`,
    });

    // Return with masked key
    return NextResponse.json({
      key: { ...entry, encryptedKey: maskKey(plainKey), iv: "" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to add API key" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, plainKey, actor } = await request.json();

    if (!id || !plainKey || !actor) {
      return NextResponse.json({ error: "id, plainKey, and actor are required" }, { status: 400 });
    }

    const { encrypted, iv } = encrypt(plainKey);
    const supabase = createServerClient();

    const { data: config } = await supabase
      .from("admin_config")
      .select("api_keys")
      .eq("id", "global")
      .single();

    const keys = (config?.api_keys ?? []).map((k: Record<string, unknown>) =>
      k.id === id
        ? { ...k, encryptedKey: encrypted, iv, lastRotated: new Date().toISOString(), testStatus: "untested" }
        : k
    );

    const { error } = await supabase
      .from("admin_config")
      .update({ api_keys: keys, updated_at: new Date().toISOString() })
      .eq("id", "global");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("api_key_audit_log").insert({
      source_id: id,
      action: "rotated",
      actor,
      result: "Key rotated",
    });

    const rotated = keys.find((k: Record<string, unknown>) => k.id === id);
    return NextResponse.json({
      key: rotated ? { ...rotated, encryptedKey: maskKey(plainKey), iv: "" } : null,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to rotate API key" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, actor } = await request.json();

    if (!id || !actor) {
      return NextResponse.json({ error: "id and actor are required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("api_keys")
      .eq("id", "global")
      .single();

    const keys = (config?.api_keys ?? []).filter((k: Record<string, unknown>) => k.id !== id);

    const { error } = await supabase
      .from("admin_config")
      .update({ api_keys: keys, updated_at: new Date().toISOString() })
      .eq("id", "global");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("api_key_audit_log").insert({
      source_id: id,
      action: "deleted",
      actor,
      result: "Key deleted",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}
