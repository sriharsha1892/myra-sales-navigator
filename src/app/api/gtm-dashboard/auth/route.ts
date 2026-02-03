import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/gtm-dashboard/queries";
import { setAuthCookie } from "@/lib/gtm-dashboard/route-auth";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    const storedPin = await getConfig("pin");
    const pinStr =
      typeof storedPin === "string" ? storedPin : JSON.stringify(storedPin);
    const cleanPin = pinStr.replace(/"/g, "");

    if (pin === cleanPin) {
      const response = NextResponse.json({ success: true });
      setAuthCookie(response, cleanPin);
      return response;
    }
    return NextResponse.json({ success: false }, { status: 401 });
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
