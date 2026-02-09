import { NextResponse } from "next/server";
import { extractICPCriteria, scoreCompaniesAgainstICP } from "@/lib/navigator/llm/icpPrompts";
import { isGroqAvailable, isGeminiAvailable } from "@/lib/navigator/llm/client";
import type { CompanyEnriched } from "@/lib/navigator/types";

export async function POST(request: Request) {
  try {
    const { query, companies } = (await request.json()) as {
      query: string;
      companies: CompanyEnriched[];
    };

    if (!query || !companies?.length) {
      return NextResponse.json({ scores: [], criteria: null });
    }

    if (!isGroqAvailable() && !isGeminiAvailable()) {
      return NextResponse.json(
        { scores: [], criteria: null, error: "No LLM provider configured" },
        { status: 503 }
      );
    }

    const criteria = await extractICPCriteria(query);
    const scores = await scoreCompaniesAgainstICP(criteria, companies);

    return NextResponse.json({ scores, criteria });
  } catch (err) {
    console.error("[ICP Score] Error:", err);
    return NextResponse.json(
      { scores: [], criteria: null, error: "ICP scoring failed" },
      { status: 500 }
    );
  }
}
