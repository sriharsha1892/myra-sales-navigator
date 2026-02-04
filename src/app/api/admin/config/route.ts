import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { defaultFreshsalesSettings } from "@/lib/navigator/mock-data";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("admin_config")
      .select("*")
      .eq("id", "global")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map snake_case columns to camelCase
    const config = {
      icpWeights: data.icp_weights,
      verticals: data.verticals,
      sizeSweetSpot: data.size_sweet_spot,
      signalTypes: data.signal_types,
      teamMembers: data.team_members,
      cacheDurations: data.cache_durations,
      copyFormats: data.copy_formats,
      defaultCopyFormat: data.default_copy_format,
      apiKeys: data.api_keys ?? [],
      dataSources: data.data_sources ?? [],
      exportSettings: data.export_settings ?? {},
      emailVerification: data.email_verification ?? {},
      scoringSettings: data.scoring_settings ?? {},
      rateLimits: data.rate_limits ?? {},
      notifications: data.notifications ?? {},
      dataRetention: data.data_retention ?? {},
      authSettings: data.auth_settings ?? {},
      uiPreferences: data.ui_preferences ?? {},
      emailPrompts: data.email_prompts ?? {},
      analyticsSettings: data.analytics_settings ?? {},
      enrichmentLimits: data.enrichment_limits ?? { maxSearchEnrich: 10, maxContactAutoEnrich: 5, maxClearoutFinds: 10 },
      icpProfiles: data.icp_profiles ?? [],
      freshsalesSettings: (() => {
        const db = (data.freshsales_settings ?? {}) as Record<string, unknown>;
        return {
          ...defaultFreshsalesSettings,
          ...db,
          statusLabels: { ...defaultFreshsalesSettings.statusLabels, ...((db.statusLabels as Record<string, string>) ?? {}) },
          icpWeights: { ...defaultFreshsalesSettings.icpWeights, ...((db.icpWeights as Record<string, number>) ?? {}) },
        };
      })(),
      authLog: data.auth_log ?? [],
      authRequests: data.auth_requests ?? [],
      outreachChannelConfig: data.outreach_channel_config ?? {
        enabledChannels: ["email", "linkedin_connect", "linkedin_inmail", "whatsapp"],
        defaultChannel: "email",
        channelInstructions: {},
        writingRulesDefault: "",
      },
      outreachSuggestionRules: data.outreach_suggestion_rules ?? [],
      actionRecommendationRules: data.action_recommendation_rules ?? [],
      actionRecommendationEnabled: data.action_recommendation_enabled ?? true,
    };

    // Mask API keys in the response
    if (config.apiKeys.length > 0) {
      config.apiKeys = config.apiKeys.map((k: Record<string, unknown>) => ({
        ...k,
        encryptedKey: "****",
        iv: "",
      }));
    }

    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch admin config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServerClient();

    // Map camelCase to snake_case for DB
    const updates: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      icpWeights: "icp_weights",
      verticals: "verticals",
      sizeSweetSpot: "size_sweet_spot",
      signalTypes: "signal_types",
      teamMembers: "team_members",
      cacheDurations: "cache_durations",
      copyFormats: "copy_formats",
      defaultCopyFormat: "default_copy_format",
      apiKeys: "api_keys",
      dataSources: "data_sources",
      exportSettings: "export_settings",
      emailVerification: "email_verification",
      scoringSettings: "scoring_settings",
      rateLimits: "rate_limits",
      notifications: "notifications",
      dataRetention: "data_retention",
      authSettings: "auth_settings",
      uiPreferences: "ui_preferences",
      emailPrompts: "email_prompts",
      analyticsSettings: "analytics_settings",
      enrichmentLimits: "enrichment_limits",
      icpProfiles: "icp_profiles",
      freshsalesSettings: "freshsales_settings",
      authLog: "auth_log",
      authRequests: "auth_requests",
      outreachChannelConfig: "outreach_channel_config",
      outreachSuggestionRules: "outreach_suggestion_rules",
      actionRecommendationRules: "action_recommendation_rules",
      actionRecommendationEnabled: "action_recommendation_enabled",
    };

    for (const [key, value] of Object.entries(body)) {
      const dbCol = fieldMap[key];
      if (dbCol) {
        updates[dbCol] = value;
      }
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("admin_config")
      .update(updates)
      .eq("id", "global");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update admin config" },
      { status: 500 }
    );
  }
}
