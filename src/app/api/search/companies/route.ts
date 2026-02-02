import { NextResponse } from "next/server";
import { reformulateQuery } from "@/lib/exa/queryBuilder";
import { searchExa, isExaAvailable } from "@/lib/providers/exa";
import type { Company, FilterState } from "@/lib/types";

export async function POST(request: Request) {
  let body: { filters?: FilterState; freeText?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const filters = body.filters;
  const freeText = body.freeText;

  if (!filters && !freeText) {
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries: [],
      message: "No search criteria provided.",
    });
  }

  // LLM query reformulation (Groq) — expands raw text into semantic queries
  const defaultFilters: FilterState = {
    sources: [],
    verticals: [],
    regions: [],
    sizes: [],
    signals: [],
    hideExcluded: true,
    quickFilters: [],
  };
  const reformulatedQueries = await reformulateQuery(
    freeText || "",
    filters || defaultFilters
  );

  if (!isExaAvailable()) {
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries,
      message: "EXA_API_KEY not configured. Search unavailable.",
    }, { status: 503 });
  }

  try {
    // Use first reformulated query (best semantic expansion).
    // Single query = 2 Exa calls (company + news), well within 5 req/s limit.
    const primaryQuery = reformulatedQueries[0] || freeText || "";
    const result = await searchExa({ query: primaryQuery, numResults: 25 });

    const companies = result.companies.slice(0, 25);
    const allSignals = result.signals;

    // TODO: Apply exclusion filter from Supabase

    return NextResponse.json({
      companies,
      signals: allSignals,
      reformulatedQueries,
    });
  } catch (err) {
    console.error("[Search] Exa search failed:", err);
    return NextResponse.json({
      companies: [],
      signals: [],
      reformulatedQueries,
      error: "Search failed. Please try again.",
    }, { status: 500 });
  }
}
