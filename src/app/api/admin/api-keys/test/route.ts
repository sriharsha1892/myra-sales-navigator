import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

// Health check endpoints for known sources
const HEALTH_ENDPOINTS: Record<string, { url: string; headers: (key: string) => Record<string, string> }> = {
  exa: {
    url: "https://api.exa.ai/search",
    headers: (key) => ({ "x-api-key": key, "Content-Type": "application/json" }),
  },
  apollo: {
    url: "https://api.apollo.io/api/v1/auth/health",
    headers: (key) => ({ "x-api-key": key, "Content-Type": "application/json" }),
  },
  hubspot: {
    url: "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  clearout: {
    url: "https://api.clearout.io/v2/credits/balance",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

export async function POST(request: NextRequest) {
  try {
    const { sourceId, actor } = await request.json();

    if (!sourceId || !actor) {
      return NextResponse.json({ error: "sourceId and actor are required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("api_keys")
      .eq("id", "global")
      .single();

    const entry = (config?.api_keys ?? []).find((k: Record<string, unknown>) => k.id === sourceId);
    if (!entry) {
      return NextResponse.json({ error: "Key not found", status: "failed" }, { status: 404 });
    }

    let status: "success" | "failed" = "failed";
    let result = "";

    try {
      const plainKey = decrypt(entry.encryptedKey, entry.iv);
      const healthConfig = HEALTH_ENDPOINTS[entry.source];

      if (healthConfig) {
        const res = await fetch(healthConfig.url, {
          method: "GET",
          headers: healthConfig.headers(plainKey),
          signal: AbortSignal.timeout(10000),
        });
        status = res.ok ? "success" : "failed";
        result = `HTTP ${res.status}`;
      } else {
        // Unknown source — just validate the key decrypts
        status = plainKey.length > 0 ? "success" : "failed";
        result = "Key decrypted successfully (no health endpoint configured)";
      }
    } catch (err) {
      status = "failed";
      result = err instanceof Error ? err.message : "Unknown error";
    }

    // Update test status in config
    const keys = (config?.api_keys ?? []).map((k: Record<string, unknown>) =>
      k.id === sourceId
        ? { ...k, testStatus: status, lastTested: new Date().toISOString() }
        : k
    );

    await supabase
      .from("admin_config")
      .update({ api_keys: keys, updated_at: new Date().toISOString() })
      .eq("id", "global");

    // Audit log
    await supabase.from("api_key_audit_log").insert({
      source_id: sourceId,
      action: "tested",
      actor,
      result: `${status}: ${result}`,
    });

    return NextResponse.json({ status, result });
  } catch (err) {
    console.error("POST /api/admin/api-keys/test error:", err);
    return NextResponse.json({ error: "Test failed", status: "failed" }, { status: 500 });
  }
}
