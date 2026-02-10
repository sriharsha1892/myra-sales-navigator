import { NextResponse } from "next/server";
import { extractSignals, isExaAvailable, isNoiseDomain } from "@/lib/navigator/providers/exa";
import { getCached, setCached } from "@/lib/cache";
import { CACHE_TTLS } from "@/lib/navigator/cache-config";
import Exa from "exa-js";

let _exa: Exa | null = null;
function getExaClient(): Exa {
  if (!_exa) {
    _exa = new Exa(process.env.EXA_API_KEY!);
  }
  return _exa;
}

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

  if (!isExaAvailable()) {
    return NextResponse.json({ signals: [], message: "EXA_API_KEY not configured." });
  }

  try {
    const exa = getExaClient();

    // Fetch recent news/content about this domain from Exa
    const newsResults = await exa.search(`${decoded} company news announcements`, {
      type: "auto",
      numResults: 10,
      category: "news" as never,
      includeDomains: [decoded],
      contents: {
        highlights: {
          numSentences: 6,
          highlightsPerUrl: 6,
        },
      },
    });

    // Also search for the domain name broadly (catches mentions on other sites)
    const mentionResults = await exa.search(`"${decoded}" hiring OR funding OR expansion OR partnership`, {
      type: "auto",
      numResults: 10,
      category: "news" as never,
      contents: {
        highlights: {
          numSentences: 4,
          highlightsPerUrl: 4,
        },
      },
    });

    // Filter noise domains from mention results (LinkedIn, Reddit, Wikipedia, etc.)
    const filteredMentions = mentionResults.results.filter(r => {
      try {
        const d = new URL(r.url).hostname.replace(/^www\./, "");
        return !isNoiseDomain(d);
      } catch { return true; }
    });

    // Combine all results into a single content string for LLM extraction
    const allResults = [...newsResults.results, ...filteredMentions];
    if (allResults.length === 0) {
      return NextResponse.json({ signals: [] });
    }

    const exaContent = allResults
      .map((r) => {
        const highlights = (r as { highlights?: string[] }).highlights?.join(" ") || "";
        return `[${r.title}] (${r.url})\n${highlights}`;
      })
      .join("\n\n");

    const signals = await extractSignals(exaContent, decoded);

    // Attach source URLs from results to matching signals
    for (const signal of signals) {
      const match = allResults.find(
        (r) =>
          r.title &&
          signal.title.toLowerCase().includes(r.title.toLowerCase().slice(0, 20))
      );
      if (match) {
        signal.sourceUrl = match.url;
      }
    }

    if (signals.length > 0) {
      await setCached(cacheKey, signals, CACHE_TTLS.signalExtraction);
    }

    return NextResponse.json({ signals });
  } catch (err) {
    console.error(`[Signals] Failed for ${decoded}:`, err);
    return NextResponse.json({ signals: [], error: "Signal extraction failed." });
  }
}
