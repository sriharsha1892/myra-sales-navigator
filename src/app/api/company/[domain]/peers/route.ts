import { NextResponse } from "next/server";
import { getFreshsalesPeers } from "@/lib/navigator/providers/freshsales";
import { searchExa, isExaAvailable } from "@/lib/navigator/providers/exa";
import { enrichCompany } from "@/lib/navigator/providers/apollo";
import { getCached, setCached } from "@/lib/cache";
import type { CompanyEnriched } from "@/lib/navigator/types";

interface PeersResponse {
  freshsalesPeers: Partial<CompanyEnriched>[];
  exaPeers: Partial<CompanyEnriched>[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  if (!domain) {
    return NextResponse.json({ freshsalesPeers: [], exaPeers: [] });
  }

  const cacheKey = `peers:${domain.toLowerCase()}`;
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

    const [freshsalesPeers, exaPeers] = await Promise.all([
      // Freshsales peers: same industry
      industry
        ? getFreshsalesPeers(industry, domain, 10).then((peers) =>
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
      // Exa peers: semantic similarity
      isExaAvailable()
        ? searchExa({ query: `companies similar to ${domain}`, numResults: 10 })
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
    await setCached(cacheKey, response, 60);

    return NextResponse.json(response);
  } catch (err) {
    console.error("[Peers] Error:", err);
    return NextResponse.json({ freshsalesPeers: [], exaPeers: [] });
  }
}
