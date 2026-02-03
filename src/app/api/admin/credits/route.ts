import { NextResponse } from "next/server";
import { getClearoutCredits } from "@/lib/providers/clearout";
import { isApolloAvailable, getApolloCredits } from "@/lib/providers/apollo";
import { isExaAvailable } from "@/lib/providers/exa";
import { isHubSpotAvailable } from "@/lib/providers/hubspot";
import { isClearoutAvailable } from "@/lib/providers/clearout";
import { isFreshsalesAvailable } from "@/lib/providers/freshsales";

export interface ProviderStatus {
  configured: boolean;
  credits: { available: number; total: number } | null;
  dashboardUrl: string | null;
}

export async function GET() {
  try {
    const [clearoutCredits, apolloCredits] = await Promise.all([
      isClearoutAvailable() ? getClearoutCredits() : Promise.resolve(null),
      isApolloAvailable() ? getApolloCredits() : Promise.resolve(null),
    ]);

    const providers: Record<string, ProviderStatus> = {
      exa: {
        configured: isExaAvailable(),
        credits: null,
        dashboardUrl: "https://dashboard.exa.ai",
      },
      apollo: {
        configured: isApolloAvailable(),
        credits: apolloCredits,
        dashboardUrl: "https://app.apollo.io/#/settings/credits",
      },
      hubspot: {
        configured: isHubSpotAvailable(),
        credits: null,
        dashboardUrl: "https://app.hubspot.com/usage-reporting",
      },
      clearout: {
        configured: isClearoutAvailable(),
        credits: clearoutCredits,
        dashboardUrl: null,
      },
      freshsales: {
        configured: isFreshsalesAvailable(),
        credits: null,
        dashboardUrl: "https://mordorintelligence.freshsales.io",
      },
    };

    return NextResponse.json({ providers });
  } catch (err) {
    console.error("[Credits] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch provider status" },
      { status: 500 }
    );
  }
}
