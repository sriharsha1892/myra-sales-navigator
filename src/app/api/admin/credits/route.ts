import { NextResponse } from "next/server";
import { getClearoutCredits } from "@/lib/navigator/providers/clearout";
import { isApolloAvailable, getApolloCredits } from "@/lib/navigator/providers/apollo";
import { isExaAvailable } from "@/lib/navigator/providers/exa";
import { isHubSpotAvailable } from "@/lib/navigator/providers/hubspot";
import { isClearoutAvailable } from "@/lib/navigator/providers/clearout";
import { isFreshsalesAvailable } from "@/lib/navigator/providers/freshsales";

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

    // Compute next Apollo replenish date (11th of current or next month)
    let apolloReplenishDate: string | undefined;
    if (isApolloAvailable()) {
      const now = new Date();
      const replenishDay = 11;
      let replenish: Date;
      if (now.getDate() < replenishDay) {
        replenish = new Date(now.getFullYear(), now.getMonth(), replenishDay);
      } else {
        replenish = new Date(now.getFullYear(), now.getMonth() + 1, replenishDay);
      }
      apolloReplenishDate = replenish.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    return NextResponse.json({ providers, apolloReplenishDate });
  } catch (err) {
    console.error("[Credits] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch provider status" },
      { status: 500 }
    );
  }
}
