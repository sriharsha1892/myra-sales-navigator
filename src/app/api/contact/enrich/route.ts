import { NextResponse } from "next/server";
import { enrichContact, isApolloAvailable } from "@/lib/providers/apollo";

export async function POST(request: Request) {
  if (!isApolloAvailable()) {
    return NextResponse.json(
      { contact: null, error: "APOLLO_API_KEY not configured." },
      { status: 503 }
    );
  }

  let body: { apolloId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { contact: null, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { apolloId } = body;
  if (!apolloId) {
    return NextResponse.json(
      { contact: null, error: "apolloId is required." },
      { status: 400 }
    );
  }

  try {
    const contact = await enrichContact(apolloId);
    if (!contact) {
      return NextResponse.json(
        { contact: null, error: "Contact not found or enrichment failed." },
        { status: 404 }
      );
    }

    return NextResponse.json({ contact });
  } catch (err) {
    console.error("[Contact Enrich] failed:", err);
    return NextResponse.json(
      { contact: null, error: "Enrichment failed." },
      { status: 500 }
    );
  }
}
