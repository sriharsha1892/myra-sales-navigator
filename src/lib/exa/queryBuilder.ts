import type { FilterState } from "../types";
import { getGroq, isGroqAvailable } from "../llm/client";
import { getCached, setCached } from "../cache";

/**
 * Builds an Exa search query from the current filter state.
 * Combines verticals, regions, and any free-text into a structured query.
 */
export function buildExaQuery(filters: FilterState, freeText?: string): string {
  const parts: string[] = [];

  if (freeText?.trim()) {
    parts.push(freeText.trim());
  }

  if (filters.verticals?.length > 0) {
    parts.push(`industry: ${filters.verticals.join(" OR ")}`);
  }

  if (filters.regions?.length > 0) {
    parts.push(`region: ${filters.regions.join(" OR ")}`);
  }

  if (filters.signals?.length > 0) {
    parts.push(`signals: ${filters.signals.join(", ")}`);
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// LLM Query Reformulation (Groq → Llama 3.1 8B)
// ---------------------------------------------------------------------------

const REFORMULATION_PROMPT = `You are an expert B2B sales research assistant. Given a search query and optional filters, expand it into 2-3 semantically rich search queries that would find relevant companies via a neural search engine.

Rules:
- If the query looks like a specific company name (e.g. "BASF", "Cereal Docks", "Brenntag SE"), the FIRST query MUST be the exact company name as-is. Additional queries can explore related companies.
- Each query should be a natural language sentence describing the type of company
- Include industry-specific terminology and synonyms
- Incorporate any signals (hiring, funding, expansion) naturally
- Keep each query under 150 characters
- Return JSON: { "queries": ["query1", "query2", "query3"] }

Filters context:
- Verticals: {verticals}
- Regions: {regions}
- Size signals: {sizes}
- Active signals: {signals}

User query: {query}`;

/**
 * Heuristic: does the query look like a specific company name rather than a
 * descriptive search? Short queries (1-4 words) without common search
 * keywords are likely company names and should be passed through verbatim.
 */
function looksLikeCompanyName(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  // Descriptive keywords that indicate a category search, not a name
  const descriptiveWords = [
    "companies", "company", "in", "for", "with", "hiring", "funding",
    "expanding", "industry", "sector", "region", "saas", "b2b", "b2c",
    "startups", "enterprises", "firms", "suppliers", "manufacturers",
    "distributors", "providers", "solutions", "services", "products",
  ];
  const lower = trimmed.toLowerCase();
  const hasDescriptive = descriptiveWords.some((w) => lower.includes(w));
  // 1-4 words with no descriptive keywords → likely a company name
  return words.length <= 4 && !hasDescriptive;
}

/**
 * Uses LLM to expand a raw query + filters into 2-3 semantically rich
 * search queries for Exa. Falls back to the raw query if LLM is unavailable.
 * Company name queries are always preserved as the primary query.
 */
export async function reformulateQuery(
  rawText: string,
  filters: FilterState
): Promise<string[]> {
  const isCompanyName = looksLikeCompanyName(rawText);

  // If Groq isn't configured, return the raw query unchanged
  if (!isGroqAvailable()) {
    return [buildExaQuery(filters, rawText)];
  }

  // Check cache first
  const cacheKey = `exa-query:${simpleHash(rawText + JSON.stringify(filters))}`;
  const cached = await getCached<string[]>(cacheKey);
  if (cached) return cached;

  try {
    const prompt = REFORMULATION_PROMPT
      .replace("{query}", rawText || buildExaQuery(filters))
      .replace("{verticals}", filters.verticals?.join(", ") || "none")
      .replace("{regions}", filters.regions?.join(", ") || "none")
      .replace("{sizes}", filters.sizes?.join(", ") || "none")
      .replace("{signals}", filters.signals?.join(", ") || "none");

    const groq = getGroq();
    const response = await groq.complete(prompt, { json: true, maxTokens: 512 });
    const parsed = JSON.parse(response) as { queries?: string[] };

    if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
      let queries = parsed.queries.slice(0, 3);
      // If this looks like a company name, force the exact text as the
      // primary query regardless of what the LLM returned.
      if (isCompanyName && rawText.trim()) {
        queries = [rawText.trim(), ...queries.filter((q) => q.toLowerCase() !== rawText.trim().toLowerCase())].slice(0, 3);
      }
      await setCached(cacheKey, queries, 360); // 6h TTL
      return queries;
    }
  } catch (err) {
    console.warn("[QueryBuilder] Reformulation failed, using raw query:", err);
  }

  // Fallback: return the original constructed query
  return [buildExaQuery(filters, rawText)];
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
