import { NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/cache";
import { getHubSpotStatus, isHubSpotAvailable } from "@/lib/navigator/providers/hubspot";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const normalized = normalizeDomain(decodeURIComponent(domain));

  if (!isHubSpotAvailable()) {
    return NextResponse.json({
      domain: normalized,
      status: "none",
      message: "HUBSPOT_ACCESS_TOKEN not configured.",
    }, { status: 503 });
  }

  try {
    const result = await getHubSpotStatus(normalized);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[HubSpot Status] Error:", err);
    return NextResponse.json({
      domain: normalized,
      status: "none",
      error: "Failed to fetch HubSpot status.",
    }, { status: 500 });
  }
}
