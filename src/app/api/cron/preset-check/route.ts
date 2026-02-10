import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { reformulateQueryWithEntities, looksLikeCompanyName, stripLegalSuffix } from "@/lib/navigator/exa/queryBuilder";
import { searchExa, isExaAvailable } from "@/lib/navigator/providers/exa";
import { searchSerper, isSerperAvailable } from "@/lib/navigator/providers/serper";
import { searchParallel, isParallelAvailable } from "@/lib/navigator/providers/parallel";
import { pickDiscoveryEngine, pickNameEngine, isExaFallbackAllowed, recordUsage } from "@/lib/navigator/routing/smartRouter";
import type { FilterState, CompanyEnriched } from "@/lib/navigator/types";

// ---------------------------------------------------------------------------
// Lightweight search — reuses the same engine dispatch logic as the main
// search route but only returns the count, not full enrichment.
// ---------------------------------------------------------------------------

const defaultFilters: FilterState = {
  sources: [],
  verticals: [],
  regions: [],
  sizes: [],
  signals: [],
  statuses: [],
  hideExcluded: true,
  quickFilters: [],
};

async function getResultCount(
  filters: FilterState | undefined,
  freeText: string | undefined
): Promise<number> {
  if (!filters && !freeText) return 0;

  const isNameQuery = looksLikeCompanyName(freeText || "");
  let reformulatedQueries: string[];

  if (isNameQuery && freeText?.trim()) {
    reformulatedQueries = [freeText.trim()];
  } else {
    const reformulated = await reformulateQueryWithEntities(
      freeText || "",
      filters || defaultFilters
    );
    reformulatedQueries = reformulated.queries;
  }

  const primaryQuery = reformulatedQueries[0] || freeText || "";
  const strippedQuery = stripLegalSuffix(primaryQuery);
  const numResults = isNameQuery ? 15 : 25;

  const anyEngineAvailable = isExaAvailable() || isSerperAvailable() || isParallelAvailable();
  if (!anyEngineAvailable) return 0;

  let companies: CompanyEnriched[] = [];

  if (isNameQuery) {
    const engine = await pickNameEngine();
    if (engine === "serper") {
      try {
        const result = await searchSerper(strippedQuery, numResults);
        companies = result.companies;
        if (!(result.cacheHit ?? false)) recordUsage("serper");
      } catch { /* silent */ }
      if (companies.length === 0 && isExaFallbackAllowed()) {
        try {
          const result = await searchExa({ query: strippedQuery, numResults });
          companies = result.companies;
          if (!(result.cacheHit ?? false)) recordUsage("exa");
        } catch { /* silent */ }
      }
    } else {
      try {
        const result = await searchExa({ query: strippedQuery, numResults });
        companies = result.companies;
        if (!(result.cacheHit ?? false)) recordUsage("exa");
      } catch { /* silent */ }
    }
  } else {
    const engine = await pickDiscoveryEngine();
    if (engine === "parallel") {
      try {
        const result = await searchParallel(strippedQuery, numResults);
        companies = result.companies;
        if (!(result.cacheHit ?? false)) recordUsage("parallel");
        if (result.companies.length < 3 && result.avgRelevance < 0.2 && isExaFallbackAllowed()) {
          const exaResult = await searchExa({ query: strippedQuery, numResults });
          companies = exaResult.companies;
          if (!(exaResult.cacheHit ?? false)) recordUsage("exa");
        }
      } catch {
        if (isExaFallbackAllowed()) {
          try {
            const result = await searchExa({ query: strippedQuery, numResults });
            companies = result.companies;
            if (!(result.cacheHit ?? false)) recordUsage("exa");
          } catch { /* silent */ }
        }
      }
    } else {
      try {
        const result = await searchExa({ query: strippedQuery, numResults });
        companies = result.companies;
        if (!(result.cacheHit ?? false)) recordUsage("exa");
      } catch { /* silent */ }
    }
  }

  return companies.length;
}

// ---------------------------------------------------------------------------
// GET handler — called by Vercel Cron every 6 hours
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: presets, error } = await supabase
      .from("search_presets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PresetCheck] Failed to fetch presets:", error);
      return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 });
    }

    if (!presets || presets.length === 0) {
      return NextResponse.json({ checked: 0, message: "No presets to check" });
    }

    const results: Array<{
      id: string;
      name: string;
      previousCount: number;
      currentCount: number;
      newResults: number;
      error?: string;
    }> = [];

    // Check each preset sequentially to avoid hammering search APIs
    for (const preset of presets) {
      try {
        // Extract freeText from filters if it exists (presets may store it there)
        const filters: FilterState | undefined = preset.filters;
        const freeText: string | undefined = (filters as Record<string, unknown> | undefined)?.freeText as string | undefined;

        const currentCount = await getResultCount(filters, freeText);
        const previousCount: number = preset.last_result_count ?? 0;
        const newResults = Math.max(0, currentCount - previousCount);

        // Update preset row in DB
        const updatePayload: Record<string, unknown> = {
          last_result_count: currentCount,
          last_checked_at: new Date().toISOString(),
        };

        // Only set new_result_count if there are genuinely new results
        // (accumulate — don't reset if user hasn't seen them yet)
        if (newResults > 0) {
          updatePayload.new_result_count = (preset.new_result_count ?? 0) + newResults;
        }

        await supabase
          .from("search_presets")
          .update(updatePayload)
          .eq("id", preset.id);

        results.push({
          id: preset.id,
          name: preset.name,
          previousCount,
          currentCount,
          newResults,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[PresetCheck] Error checking preset ${preset.id}:`, errorMessage);
        results.push({
          id: preset.id,
          name: preset.name,
          previousCount: preset.last_result_count ?? 0,
          currentCount: 0,
          newResults: 0,
          error: errorMessage,
        });
      }
    }

    const totalNew = results.reduce((sum, r) => sum + r.newResults, 0);
    const errored = results.filter((r) => r.error).length;

    return NextResponse.json({
      checked: results.length,
      totalNewResults: totalNew,
      errored,
      results,
    });
  } catch (err) {
    console.error("[PresetCheck] Cron handler error:", err);
    return NextResponse.json({ error: "Cron handler failed" }, { status: 500 });
  }
}
