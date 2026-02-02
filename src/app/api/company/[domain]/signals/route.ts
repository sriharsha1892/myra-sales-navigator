import { NextResponse } from "next/server";
import { extractSignals } from "@/lib/providers/exa";
import { getCached, setCached } from "@/lib/cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  // Check cache for extracted signals
  const cacheKey = `llm-signals:${decoded}`;
  const cached = await getCached<Awaited<ReturnType<typeof extractSignals>>>(cacheKey);
  if (cached) {
    return NextResponse.json({ signals: cached });
  }

  // TODO: Fetch raw content from Exa API for this domain
  // Then pass through LLM signal extraction
  // For now, demonstrate the extraction pipeline with placeholder content
  const exaContent = ""; // Will be populated when Exa API is wired

  if (exaContent) {
    const signals = await extractSignals(exaContent, decoded);
    if (signals.length > 0) {
      await setCached(cacheKey, signals, 360); // 6h TTL
    }
    return NextResponse.json({ signals });
  }

  return NextResponse.json({
    signals: [],
    message: `Signals for company ${decoded} not yet connected. Using mock data. LLM signal extraction ready.`,
  });
}
