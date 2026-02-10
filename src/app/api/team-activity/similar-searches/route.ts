import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const STOP_WORDS = new Set([
  "companies", "company", "in", "the", "and", "or", "for", "with",
  "to", "of", "a", "an", "that", "are", "is",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query");
  const user = url.searchParams.get("user");
  if (!query || !user) return NextResponse.json({ match: null });

  const supabase = createServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data } = await supabase
    .from("search_history")
    .select("user_name, label, result_count, created_at")
    .neq("user_name", user)
    .gte("created_at", sevenDaysAgo)
    .not("label", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return NextResponse.json({ match: null });

  const queryTokens = tokenize(query);
  let bestMatch: {
    user: string;
    query: string;
    at: string;
    resultCount: number;
  } | null = null;
  let bestScore = 0;

  for (const row of data) {
    if (!row.label) continue;
    const score = jaccard(queryTokens, tokenize(row.label));
    if (score > bestScore && score > 0.35) {
      bestScore = score;
      bestMatch = {
        user: row.user_name,
        query: row.label,
        at: row.created_at,
        resultCount: row.result_count ?? 0,
      };
    }
  }

  return NextResponse.json({ match: bestMatch });
}
