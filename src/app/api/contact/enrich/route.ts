import { NextRequest, NextResponse } from "next/server";
import { enrichContact, isApolloAvailable } from "@/lib/providers/apollo";
import { findEmail, isClearoutAvailable } from "@/lib/providers/clearout";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apolloId, firstName, lastName, domain } = body;

    if (!apolloId) {
      return NextResponse.json(
        { error: "apolloId is required" },
        { status: 400 }
      );
    }

    if (!isApolloAvailable()) {
      return NextResponse.json(
        { error: "Apollo not configured", contact: null },
        { status: 503 }
      );
    }

    const contact = await enrichContact(apolloId, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      domain: domain || undefined,
    });

    if (!contact) {
      return NextResponse.json({ contact: null, message: "No data found" });
    }

    // Clearout fallback: if Apollo returned contact but no email, try Clearout
    if (!contact.email && firstName && domain && isClearoutAvailable()) {
      try {
        const clearoutResult = await findEmail(
          `${firstName} ${lastName || ""}`.trim(),
          domain
        );
        if (clearoutResult.status === "found" && clearoutResult.email) {
          contact.email = clearoutResult.email;
          contact.emailConfidence = clearoutResult.confidence;
          contact.confidenceLevel =
            clearoutResult.confidence >= 90 ? "high" : clearoutResult.confidence >= 70 ? "medium" : "low";
          if (!contact.sources.includes("clearout")) {
            contact.sources = [...contact.sources, "clearout"];
          }
        }
      } catch (clearoutErr) {
        console.warn("[Contact Enrich] Clearout fallback failed:", clearoutErr);
      }
    }

    return NextResponse.json({ contact });
  } catch (err) {
    console.error("[Contact Enrich] error:", err);
    return NextResponse.json(
      { error: "Failed to enrich contact", contact: null },
      { status: 500 }
    );
  }
}
