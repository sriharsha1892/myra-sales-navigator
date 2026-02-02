import { NextResponse } from "next/server";
import { completeWithFallback, isGroqAvailable } from "@/lib/llm/client";
import { getCached, setCached, normalizeDomain } from "@/lib/cache";
import { enrichCompany, isApolloAvailable } from "@/lib/providers/apollo";
import { getHubSpotStatus, isHubSpotAvailable } from "@/lib/providers/hubspot";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  const normalized = normalizeDomain(decoded);

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

  return NextResponse.json({
    company,
    hubspotStatus,
    aiSummary: aiSummary || null,
    sources: {
      apollo: isApolloAvailable() && !!apolloData,
      hubspot: isHubSpotAvailable() && hubspotStatus.status !== "none",
    },
  });
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
