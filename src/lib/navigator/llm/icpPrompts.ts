import { getGroq, getGemini } from "./client";
import type { NLICPCriteria, NLICPScore, CompanyEnriched } from "../types";

// ---------------------------------------------------------------------------
// Step 1: Extract ICP criteria from search query (Groq — fast, ~200ms)
// ---------------------------------------------------------------------------

export async function extractICPCriteria(query: string): Promise<NLICPCriteria> {
  const prompt = `You are a B2B sales intelligence assistant. Extract ideal customer profile (ICP) criteria from this search query.

Search query: "${query}"

Return a JSON object with these fields:
- description: 1-sentence summary of what the user is looking for
- targetVerticals: array of industry verticals (e.g. ["food ingredients", "chemicals"])
- targetRegions: array of geographic regions (e.g. ["Asia Pacific", "Europe"])
- targetSizeRange: object with min/max employee count, or null if not specified
- buyingSignals: array of positive signals to look for (e.g. ["hiring", "expanding"])
- negativeSignals: array of red flags (e.g. ["layoffs", "downsizing"])
- qualitativeFactors: array of other qualitative fit criteria

Be specific. If the query doesn't mention a field, use an empty array or null.
Return ONLY valid JSON, no markdown.`;

  try {
    const raw = await getGroq().complete(prompt, { json: true, maxTokens: 512, temperature: 0.2 });
    const parsed = JSON.parse(raw);
    return {
      description: parsed.description || query,
      targetVerticals: Array.isArray(parsed.targetVerticals) ? parsed.targetVerticals : [],
      targetRegions: Array.isArray(parsed.targetRegions) ? parsed.targetRegions : [],
      targetSizeRange: parsed.targetSizeRange || null,
      buyingSignals: Array.isArray(parsed.buyingSignals) ? parsed.buyingSignals : [],
      negativeSignals: Array.isArray(parsed.negativeSignals) ? parsed.negativeSignals : [],
      qualitativeFactors: Array.isArray(parsed.qualitativeFactors) ? parsed.qualitativeFactors : [],
    };
  } catch (err) {
    console.warn("[NL-ICP] Criteria extraction failed, using defaults:", err);
    return {
      description: query,
      targetVerticals: [],
      targetRegions: [],
      targetSizeRange: null,
      buyingSignals: [],
      negativeSignals: [],
      qualitativeFactors: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Step 2: Score companies against ICP criteria (Gemini — batches of 5)
// ---------------------------------------------------------------------------

export async function scoreCompaniesAgainstICP(
  criteria: NLICPCriteria,
  companies: CompanyEnriched[]
): Promise<NLICPScore[]> {
  if (companies.length === 0) return [];

  const BATCH_SIZE = 5;
  const batches: CompanyEnriched[][] = [];
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    batches.push(companies.slice(i, i + BATCH_SIZE));
  }

  const allScores: NLICPScore[] = [];

  // Process batches in parallel (max 3 concurrent to avoid rate limits)
  const concurrency = Math.min(batches.length, 3);
  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map((batch) => scoreBatch(criteria, batch))
    );
    for (const r of results) {
      if (r.status === "fulfilled") allScores.push(...r.value);
    }
  }

  return allScores;
}

async function scoreBatch(
  criteria: NLICPCriteria,
  companies: CompanyEnriched[]
): Promise<NLICPScore[]> {
  const companySummaries = companies.map((c) => ({
    domain: c.domain,
    name: c.name,
    industry: c.industry || c.vertical || "Unknown",
    employees: c.employeeCount || 0,
    location: c.location || c.region || "Unknown",
    description: (c.description || "").slice(0, 200),
    signals: c.signals?.slice(0, 3).map((s) => s.type) || [],
    revenue: c.revenue || "Unknown",
  }));

  const prompt = `You are a B2B sales qualification engine. Score each company on how well it matches the ideal customer profile (ICP).

ICP Criteria:
- Looking for: ${criteria.description}
- Target verticals: ${criteria.targetVerticals.join(", ") || "any"}
- Target regions: ${criteria.targetRegions.join(", ") || "any"}
- Target size: ${criteria.targetSizeRange ? `${criteria.targetSizeRange.min}-${criteria.targetSizeRange.max} employees` : "any"}
- Positive signals: ${criteria.buyingSignals.join(", ") || "none specified"}
- Red flags: ${criteria.negativeSignals.join(", ") || "none specified"}
- Other factors: ${criteria.qualitativeFactors.join(", ") || "none"}

Companies to score:
${JSON.stringify(companySummaries, null, 1)}

For each company, return a JSON array of objects with:
- domain: the company domain
- score: 0-100 ICP fit score (0=terrible fit, 100=perfect fit)
- reasoning: 1-2 sentence explanation of why this score

Be discriminating. Use the full 0-100 range. A generic company with no clear fit should score 20-40. Only score 70+ if there's clear vertical/region/signal alignment.

Return ONLY a JSON array, no markdown.`;

  try {
    const raw = await getGemini().complete(prompt, { json: true, maxTokens: 1024, temperature: 0.3 });
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.scores || parsed.results || [];
    return arr.map((item: { domain?: string; score?: number; reasoning?: string }) => ({
      domain: item.domain || "",
      score: typeof item.score === "number" ? Math.max(0, Math.min(100, item.score)) : 50,
      reasoning: item.reasoning || "",
    }));
  } catch (err) {
    console.warn("[NL-ICP] Batch scoring failed:", err);
    // Return neutral scores for this batch
    return companies.map((c) => ({
      domain: c.domain,
      score: 50,
      reasoning: "Scoring unavailable",
      scoringFailed: true,
    }));
  }
}
