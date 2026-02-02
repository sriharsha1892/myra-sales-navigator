import { NextRequest, NextResponse } from "next/server";
import { completeWithFallback, isGroqAvailable } from "@/lib/llm/client";
import { getCached, setCached, normalizeDomain } from "@/lib/cache";
import { enrichCompany, isApolloAvailable } from "@/lib/providers/apollo";
import { getHubSpotStatus, isHubSpotAvailable } from "@/lib/providers/hubspot";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const decoded = decodeURIComponent(domain);
    const normalized = normalizeDomain(decoded);

    // Get viewer name from cookie for anchor tracking
    const cookieStore = await cookies();
    const userName = cookieStore.get("user_name")?.value || "Unknown";

    // Fetch Apollo enrichment + HubSpot status + AI summary in parallel
    const [apolloData, hubspotStatus, aiSummary] = await Promise.all([
      enrichCompany(normalized),
      getHubSpotStatus(normalized),
      generateAiSummary(normalized),
    ]);

    const company = apolloData ? { ...apolloData } : null;

    // Merge HubSpot status into company object
    if (company && hubspotStatus) {
      company.hubspotStatus = hubspotStatus.status;
    }

    // Track company view in Supabase (anchor: first_viewed + last_viewed)
    try {
      const supabase = createServerClient();
      const companyName = company?.name || normalized;
      const source = company?.sources?.[0] || "exa";

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

    return NextResponse.json({
      company,
      hubspotStatus,
      aiSummary: aiSummary || null,
      sources: {
        apollo: isApolloAvailable() && !!apolloData,
        hubspot: isHubSpotAvailable() && hubspotStatus.status !== "none",
      },
    });
  } catch (err) {
    console.error("[Company] Dossier API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch company dossier", company: null, sources: { apollo: false, hubspot: false }, aiSummary: null },
      { status: 500 }
    );
  }
}

async function generateAiSummary(domain: string): Promise<string | null> {
  const cacheKey = `ai-summary:${domain}`;
  const cached = await getCached<string>(cacheKey);
  if (cached) return cached;

  if (!isGroqAvailable()) return null;

  try {
    const summaryPrompt = `Write a 2-3 sentence executive summary for a B2B sales team about the company with domain "${domain}". Include what they do, their size/stage if inferrable, and anything relevant for sales outreach. Be factual and concise. If you don't have specific information, say so briefly.`;

    const result = await completeWithFallback(summaryPrompt, {
      maxTokens: 256,
      temperature: 0.3,
    });

    if (result) {
      await setCached(cacheKey, result, 360); // 6h TTL
    }

    return result;
  } catch (err) {
    console.warn("[Company] AI summary generation failed:", err);
    return null;
  }
}
