import { createServerClient } from "@/lib/supabase/server";
import type { AuthLogEntry } from "@/lib/navigator/types";

const MAX_LOG_ENTRIES = 200;

export type AuthAction =
  | "generated_link"
  | "logged_in"
  | "revoked"
  | "requested_access"
  | "added_member"
  | "removed_member";

export async function logAuthEvent(
  action: AuthAction,
  actor: string,
  target: string
): Promise<void> {
  try {
    const supabase = createServerClient();
    const { data: config } = await supabase
      .from("admin_config")
      .select("auth_log")
      .eq("id", "global")
      .single();

    const existing: AuthLogEntry[] = config?.auth_log ?? [];
    const entry: AuthLogEntry = {
      action,
      actor,
      target,
      timestamp: new Date().toISOString(),
    };

    // FIFO: keep last MAX_LOG_ENTRIES
    const updated = [...existing, entry].slice(-MAX_LOG_ENTRIES);

    await supabase
      .from("admin_config")
      .update({ auth_log: updated })
      .eq("id", "global");
  } catch {
    // Non-critical — don't break auth flow if logging fails
    console.error("Failed to log auth event:", action, actor, target);
  }
}
