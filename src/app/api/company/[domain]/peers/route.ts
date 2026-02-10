import { NextResponse } from "next/server";
import { getFreshsalesPeers } from "@/lib/navigator/providers/freshsales";
import { searchExa, isExaAvailable } from "@/lib/navigator/providers/exa";
import { enrichCompany } from "@/lib/navigator/providers/apollo";
import { getCached, setCached } from "@/lib/cache";
import { CACHE_TTLS } from "@/lib/navigator/cache-config";
import type { CompanyEnriched } from "@/lib/navigator/types";

interface PeersResponse {
  freshsalesPeers: Partial<CompanyEnriched>[];
  exaPeers: Partial<CompanyEnriched>[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  if (!domain) {
    return NextResponse.json({ freshsalesPeers: [], exaPeers: [] });
  }

  // Parse optional size/region query params
  const url = new URL(request.url);
  const minSizeParam = url.searchParams.get("minSize");
  const maxSizeParam = url.searchParams.get("maxSize");
  const regionParam = url.searchParams.get("region");

  const minSize = minSizeParam ? parseInt(minSizeParam, 10) : undefined;
  const maxSize = maxSizeParam ? parseInt(maxSizeParam, 10) : undefined;
  const region = regionParam || undefined;

  // Include size/region in cache key so different filter combos cache separately
  const filterSuffix = [
    minSize != null ? `min${minSize}` : "",
    maxSize != null ? `max${maxSize}` : "",
    region ? `r${region}` : "",
  ].filter(Boolean).join(":");
  const cacheKey = `peers:${domain.toLowerCase()}${filterSuffix ? `:${filterSuffix}` : ""}`;
  const cached = await getCached<PeersResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Get the company's industry for peer matching
    let industry = "";
    try {
      const apolloData = await enrichCompany(domain);
      industry = (apolloData?.industry || "").trim();
    } catch {
      // Continue without industry
    }

    // Build Exa query with size/region context
    let exaQuery = `companies similar to ${domain}`;
    if (minSize != null || maxSize != null) {
      if (minSize != null && maxSize != null) {
        exaQuery += ` with ${minSize} to ${maxSize} employees`;
      } else if (minSize != null) {
        exaQuery += ` with more than ${minSize} employees`;
      } else if (maxSize != null) {
        exaQuery += ` with fewer than ${maxSize} employees`;
      }
    }
    if (region) {
      exaQuery += ` in ${region}`;
    }

    const peerOptions = (minSize != null || maxSize != null || region)
      ? { minSize, maxSize, region }
      : undefined;

    const [freshsalesPeers, exaPeers] = await Promise.all([
      // Freshsales peers: same industry + optional size/region filters
      industry
        ? getFreshsalesPeers(industry, domain, 10, peerOptions).then((peers) =>
            peers
              .filter((p) => p.domain && p.domain !== domain)
              .map((p) => ({
                domain: p.domain,
                name: p.account?.name || p.domain,
                industry: p.account?.industry || industry,
                employeeCount: p.account?.employees || 0,
                sources: ["freshsales" as const],
                peerSource: "freshsales" as const,
                freshsalesStatus: p.status,
                icpScore: 0,
              }))
          )
        : Promise.resolve([]),
      // Exa peers: semantic similarity with optional size/region context
      isExaAvailable()
        ? searchExa({ query: exaQuery, numResults: 10 })
            .then((result) =>
              result.companies
                .filter((c) => c.domain !== domain)
                .slice(0, 10)
                .map((c) => ({
                  ...c,
                  peerSource: "exa" as const,
                }))
            )
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const response: PeersResponse = {
      freshsalesPeers: freshsalesPeers as Partial<CompanyEnriched>[],
      exaPeers: exaPeers as Partial<CompanyEnriched>[],
    };

    // Cache for 1 hour
    await setCached(cacheKey, response, CACHE_TTLS.peers);

    return NextResponse.json(response);
  } catch (err) {
    console.error("[Peers] Error:", err);
    return NextResponse.json({ freshsalesPeers: [], exaPeers: [] });
  }
}
