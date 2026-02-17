import { NextRequest, NextResponse } from "next/server";
import { completeWithFallback, isGroqAvailable } from "@/lib/navigator/llm/client";
import { getCached, setCached, normalizeDomain, getRootDomain } from "@/lib/cache";
import { enrichCompany, isApolloAvailable } from "@/lib/navigator/providers/apollo";
import { getHubSpotStatus, isHubSpotAvailable } from "@/lib/navigator/providers/hubspot";
import { getFreshsalesIntel, isFreshsalesAvailable } from "@/lib/navigator/providers/freshsales";
import { calculateIcpScore } from "@/lib/navigator/scoring";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { trackUsageEventServer } from "@/lib/navigator/analytics-server";
import type { CompanyEnriched, IcpWeights, FreshsalesSettings } from "@/lib/navigator/types";
import { CACHE_TTLS } from "@/lib/navigator/cache-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const normalized = normalizeDomain(decoded);
    const companyName = request.nextUrl.searchParams.get("name") || undefined;
    const crmOnly = request.nextUrl.searchParams.get("crmOnly") === "true";
    const forceRegenSummary = request.nextUrl.searchParams.get("regenerateSummary") === "true";

    // Fast path: only fetch CRM status (Freshsales + HubSpot), skip everything else
    if (crmOnly) {
      const [hubspotStatus, freshsalesIntel] = await Promise.all([
        getHubSpotStatus(normalized),
        getFreshsalesIntel(getRootDomain(normalized), companyName),
      ]);
      return NextResponse.json({
        freshsalesStatus: freshsalesIntel?.status ?? "none",
        freshsalesIntel: freshsalesIntel ?? null,
        hubspotStatus: hubspotStatus?.status ?? "none",
      });
    }

    // Get viewer name from cookie for anchor tracking
    const cookieStore = await cookies();
    const userName = cookieStore.get("user_name")?.value || "Unknown";

    // Fetch Apollo enrichment + HubSpot status + Freshsales intel + AI summary in parallel
    const [apolloData, hubspotStatus, freshsalesIntel, aiSummary] = await Promise.all([
      enrichCompany(normalized),
      getHubSpotStatus(normalized),
      getFreshsalesIntel(getRootDomain(normalized), companyName),
      generateAiSummary(normalized, forceRegenSummary),
    ]);

    const freshsalesAvailable = isFreshsalesAvailable();

    // Always return a company shell — use Apollo data if available, else minimal shell
    const company: Record<string, unknown> = apolloData
      ? { ...apolloData }
      : { domain: normalized, name: normalized, sources: [] as string[] };

    // Merge HubSpot status into company object
    if (hubspotStatus) {
      company.hubspotStatus = hubspotStatus.status;
    }

    // Merge Freshsales status into company object
    if (freshsalesIntel) {
      company.freshsalesStatus = freshsalesIntel.status;
    }

    // Track company view in Supabase (anchor: first_viewed + last_viewed)
    try {
      const supabase = createServerClient();
      const companyName = (company?.name as string) || normalized;
      const sources = company?.sources as string[] | undefined;
      const source = sources?.[0] || "exa";

      // Try update first (faster for existing companies)
      const { data: existing } = await supabase
        .from("companies")
        .select("domain")
        .eq("domain", normalized)
        .single();

      if (existing) {
        await supabase
          .from("companies")
          .update({
            last_viewed_by: userName,
            last_viewed_at: new Date().toISOString(),
          })
          .eq("domain", normalized);
      } else {
        await supabase.from("companies").insert({
          domain: normalized,
          name: companyName,
          first_viewed_by: userName,
          first_viewed_at: new Date().toISOString(),
          last_viewed_by: userName,
          last_viewed_at: new Date().toISOString(),
          source,
        });
      }
    } catch (anchorErr) {
      // Don't fail the response if anchor tracking fails
      console.warn("[Company] Anchor tracking failed:", anchorErr);
    }

    // Track usage event (fire-and-forget)
    trackUsageEventServer("dossier_view", userName, {
      domain: normalized,
      companyName: (company?.name as string) || normalized,
    });

    // ICP scoring for dossier view — fetch admin weights + freshsales tag config
    let icpWeights: Partial<IcpWeights> = {};
    let fsSettings: Partial<FreshsalesSettings> | null = null;
    try {
      const cachedWeights = await getCached<IcpWeights>("admin:icp-weights");
      const cachedFs = await getCached<FreshsalesSettings>("admin:freshsales-settings");
      if (cachedWeights) {
        icpWeights = cachedWeights;
        fsSettings = cachedFs;
      } else {
        const supabase = createServerClient();
        const { data: configRow } = await supabase
          .from("admin_config")
          .select("icp_weights, freshsales_settings")
          .eq("id", "global")
          .single();
        if (configRow?.icp_weights) {
          icpWeights = configRow.icp_weights as IcpWeights;
          await setCached("admin:icp-weights", icpWeights, CACHE_TTLS.adminConfig);
        }
        if (configRow?.freshsales_settings) {
          fsSettings = configRow.freshsales_settings as FreshsalesSettings;
          await setCached("admin:freshsales-settings", fsSettings, CACHE_TTLS.adminConfig);
        }
      }
    } catch { /* use defaults */ }

    const companyForScoring = {
      ...company,
      sources: (company.sources as string[]) || [],
      signals: (company.signals as unknown[]) || [],
    } as unknown as CompanyEnriched;
    const { score, breakdown } = calculateIcpScore(companyForScoring, icpWeights, {
      tagScoringRules: fsSettings?.tagScoringRules,
      stalledDealThresholdDays: fsSettings?.stalledDealThresholdDays,
    });
    company.icpScore = score;
    company.icpBreakdown = breakdown;

    return NextResponse.json({
      company,
      hubspotStatus,
      freshsalesIntel: freshsalesIntel ?? null,
      freshsalesAvailable,
      aiSummary: aiSummary || null,
      sources: {
        apollo: isApolloAvailable() && !!apolloData,
        hubspot: isHubSpotAvailable() && hubspotStatus.status !== "none",
        freshsales: freshsalesAvailable && freshsalesIntel.status !== "none",
      },
    });
  } catch (err) {
    console.error("[Company] Dossier API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch company dossier", company: null, sources: { apollo: false, hubspot: false, freshsales: false }, freshsalesIntel: null, aiSummary: null },
      { status: 500 }
    );
  }
}

async function generateAiSummary(domain: string, forceRefresh = false): Promise<string | null> {
  const cacheKey = `ai-summary:${domain}`;
  if (!forceRefresh) {
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;
  }

  if (!isGroqAvailable()) return null;

  try {
    const summaryPrompt = `Write 3 bullet points about the company with domain "${domain}" for a B2B sales team:
1) What they do (core business)
2) Why now (recent signal or growth indicator)
3) Who they compete with
Max 2 sentences each. No marketing fluff. Be factual and concise. If you don't have specific information for a bullet, say so briefly.`;

    const result = await completeWithFallback(summaryPrompt, {
      maxTokens: 256,
      temperature: 0.3,
    });

    if (result) {
      await setCached(cacheKey, result, CACHE_TTLS.aiSummary);
    }

    return result;
  } catch (err) {
    console.warn("[Company] AI summary generation failed:", err);
    return null;
  }
}
