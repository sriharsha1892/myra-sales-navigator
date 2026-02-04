import { NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/cache";
import { getHubSpotContacts, isHubSpotAvailable } from "@/lib/navigator/providers/hubspot";

export async function GET(request: Request) {
  if (!isHubSpotAvailable()) {
    return NextResponse.json({
      contacts: [],
      message: "HUBSPOT_ACCESS_TOKEN not configured.",
    }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({
      contacts: [],
      error: "Missing required query parameter: domain",
    }, { status: 400 });
  }

  const normalized = normalizeDomain(domain);

  try {
    const contacts = await getHubSpotContacts(normalized);
    return NextResponse.json({ contacts });
  } catch (err) {
    console.error("[HubSpot Contacts] Error:", err);
    return NextResponse.json({
      contacts: [],
      error: "Failed to fetch HubSpot contacts.",
    }, { status: 500 });
  }
}
