import { createServerClient } from "@/lib/supabase/server";
import type { AdaptiveCard, TeamsWebhookPayload, TeamsNotificationConfig, UserTeamsPreferences } from "./types";

function buildPayload(card: AdaptiveCard): TeamsWebhookPayload {
  return {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: card,
    }],
  };
}

async function postWebhook(webhookUrl: string, card: AdaptiveCard): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(card)),
    });

    if (res.ok) return true;

    // Retry once on 5xx
    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      const retry = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(card)),
      });
      return retry.ok;
    }

    console.error(`[Teams] Webhook failed: ${res.status} ${res.statusText}`);
    return false;
  } catch (err) {
    console.error("[Teams] Webhook error:", err);
    return false;
  }
}

/** Get Teams notification config from admin_config */
export async function getTeamsConfig(): Promise<TeamsNotificationConfig | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("admin_config")
      .select("notifications")
      .eq("id", "global")
      .single();

    if (!data?.notifications) return null;
    const n = data.notifications as Record<string, unknown>;
    if (!n.teamsEnabled || !n.teamChannelWebhookUrl) return null;

    return {
      teamsEnabled: Boolean(n.teamsEnabled),
      teamChannelWebhookUrl: String(n.teamChannelWebhookUrl),
      enabledNotifications: (n.enabledNotifications as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

/** Get a user's Teams webhook URL from user_config.preferences */
export async function getUserTeamsWebhook(userName: string): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("user_config")
      .select("preferences")
      .eq("user_name", userName)
      .single();

    if (!data?.preferences) return null;
    const prefs = data.preferences as UserTeamsPreferences;
    if (prefs.teamsNotificationsEnabled === false) return null;
    return prefs.teamsWebhookUrl ?? null;
  } catch {
    return null;
  }
}

/** Get all users with Teams notifications enabled */
export async function getAllTeamsUsers(): Promise<{ userName: string; webhookUrl: string | null }[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("user_config")
      .select("user_name, preferences");

    if (!data) return [];

    return data
      .filter((row) => {
        const prefs = (row.preferences ?? {}) as UserTeamsPreferences;
        return prefs.teamsNotificationsEnabled !== false;
      })
      .map((row) => ({
        userName: row.user_name,
        webhookUrl: ((row.preferences ?? {}) as UserTeamsPreferences).teamsWebhookUrl ?? null,
      }));
  } catch {
    return [];
  }
}

/** Send card to shared team channel */
// TODO: Re-enable once Teams admin grants channel Workflow access
export async function sendToChannel(_card: AdaptiveCard): Promise<boolean> {
  // const config = await getTeamsConfig();
  // if (!config?.teamChannelWebhookUrl) {
  //   console.warn("[Teams] No team channel webhook configured");
  //   return false;
  // }
  // return postWebhook(config.teamChannelWebhookUrl, card);
  return false;
}

/** Send card to a specific user's personal webhook */
export async function sendToUser(userName: string, card: AdaptiveCard): Promise<boolean> {
  const webhookUrl = await getUserTeamsWebhook(userName);
  if (!webhookUrl) {
    console.warn(`[Teams] No personal webhook for user: ${userName}`);
    return false;
  }
  return postWebhook(webhookUrl, card);
}

/** Send card to channel with a direct webhook URL (for testing) */
export async function sendToWebhookUrl(webhookUrl: string, card: AdaptiveCard): Promise<boolean> {
  return postWebhook(webhookUrl, card);
}
