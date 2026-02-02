import { NextResponse } from "next/server";
import { getClearoutCredits } from "@/lib/providers/clearout";

export async function GET() {
  try {
    const clearout = await getClearoutCredits();

    return NextResponse.json({
      clearout,
      apollo: null,
      exa: null,
      hubspot: null,
    });
  } catch (err) {
    console.error("[Credits] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch credit balances" },
      { status: 500 }
    );
  }
}
