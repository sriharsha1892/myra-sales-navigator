import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { searchExa, isExaAvailable } from "@/lib/navigator/providers/exa";
import { getCached, setCached, hashFilters, getRootDomain } from "@/lib/cache";
import { CACHE_TTLS } from "@/lib/navigator/cache-config";
import { trackUsageEventServer } from "@/lib/navigator/analytics-server";
import type { CompanyEnriched } from "@/lib/navigator/types";

interface SimilarRequestBody {
  domain: string;
  name: string;
  industry?: string;
  region?: string;
  employeeCount?: number;
  description?: string;
}

export async function POST(request: Request) {
  // Auth check
  const cookieStore = await cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: SimilarRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { domain, name, industry, region, employeeCount } = body;

  if (!domain || !name) {
    return NextResponse.json(
      { error: "domain and name are required" },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = `similar:${hashFilters({ domain: domain.toLowerCase(), name })}`;
  const cached = await getCached<{ companies: CompanyEnriched[] }>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  if (!isExaAvailable()) {
    return NextResponse.json({ companies: [] });
  }

  try {
    // Build Exa query
    let query = `companies similar to ${name}`;
    if (industry) query += ` in ${industry}`;
    if (region) query += ` in ${region}`;
    if (employeeCount) query += ` with approximately ${employeeCount} employees`;

    const result = await searchExa({ query, numResults: 10 });

    // Filter out the seed domain from results
    const seedRoot = getRootDomain(domain);
    const companies: CompanyEnriched[] = result.companies
      .filter((c) => getRootDomain(c.domain) !== seedRoot)
      .slice(0, 10);

    const response = { companies };

    // Cache for 1 hour (peers TTL)
    await setCached(cacheKey, response, CACHE_TTLS.peers).catch(() => {});

    // Track usage (fire-and-forget)
    trackUsageEventServer("find_similar", userName, { domain, industry });

    return NextResponse.json(response);
  } catch (err) {
    console.error("[Similar] Error:", err);
    return NextResponse.json({ companies: [] });
  }
}
