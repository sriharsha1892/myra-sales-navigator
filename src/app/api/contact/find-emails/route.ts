import { NextResponse } from "next/server";
import { findEmailsBatch } from "@/lib/providers/clearout";
import type { FindEmailBatchInput } from "@/lib/providers/clearout";

interface RequestBody {
  domain: string;
  contacts: { firstName: string; lastName: string; contactId: string }[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.domain || !Array.isArray(body.contacts) || body.contacts.length === 0) {
      return NextResponse.json(
        { error: "domain and contacts[] are required" },
        { status: 400 }
      );
    }

    const inputs: FindEmailBatchInput[] = body.contacts.map((c) => ({
      contactId: c.contactId,
      firstName: c.firstName,
      lastName: c.lastName,
    }));

    const maxLookups = 10;
    const results = await findEmailsBatch(inputs, body.domain, maxLookups);

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email finder failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
