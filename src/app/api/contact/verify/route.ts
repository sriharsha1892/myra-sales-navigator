import { NextRequest, NextResponse } from "next/server";
import { isClearoutAvailable, verifyEmails } from "@/lib/providers/clearout";

export async function POST(request: NextRequest) {
  if (!isClearoutAvailable()) {
    return NextResponse.json(
      { results: [], error: "Clearout API key not configured" },
      { status: 503 }
    );
  }

  let body: { emails?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emails = body.emails;
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json(
      { error: "emails must be a non-empty array of strings" },
      { status: 400 }
    );
  }

  // Cap batch size to prevent abuse
  if (emails.length > 50) {
    return NextResponse.json(
      { error: "Maximum 50 emails per request" },
      { status: 400 }
    );
  }

  try {
    const results = await verifyEmails(emails);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";

    if (message.includes("Invalid Clearout API key")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes("Credits exhausted")) {
      return NextResponse.json({ error: message }, { status: 402 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
